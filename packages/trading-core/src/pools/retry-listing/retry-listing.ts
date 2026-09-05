import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { ListingDepositChainId, RetryListingResult } from "../types";
import { retryListingV2MarketRetryListingPost, type SupportedDepositChains } from "../types/generated/listing-backend";
import { toRetryListingResult } from "./to-retry-listing-result";

/**
 * Parameters for {@link retryListing}.
 *
 * Pool listing is chain-level, so this takes only a `chainId`: the listing
 * backend is resolved from the chain. The endpoint is authed and scoped to the
 * caller — a user may only retry their own rejected market.
 */
export type RetryListingParameters = Compute<
  ChainIdParameter & {
    /**
     * Bearer token from `authenticateListing`; required — the endpoint is authed.
     * Sent as the `Authorization: Bearer <token>` header; a bad or expired token
     * yields a `401`.
     */
    accessToken: string;
    /** The rejected market's token contract address. */
    tokenContractAddress: string;
    /** The chain the token/deposit lives on — the market's `chainId`. */
    depositChain: ListingDepositChainId;
  }
>;

/** Return type of {@link retryListing}: the retry allowance left after this retry. */
export type RetryListingReturnType = RetryListingResult;

/**
 * Retry a **rejected** market's listing — re-submit a market whose listing was
 * rejected, instead of refunding it.
 *
 * POSTs to `/v2/market/retry-listing` with the caller's bearer token. Retries are
 * capped and rate-limited: read {@link getRetryListingInfo} first and only offer
 * this when `remainingRetries > 0` and the cooldown has elapsed. On success the
 * market re-enters the listing pipeline (its `marketStatus` moves off `REJECTED`)
 * and the response reports the retry allowance left. Enigma-only.
 *
 * @param config - The SDK config.
 * @param parameters - The bearer token, the market's token contract address, and its deposit chain.
 * @returns The {@link RetryListingResult}: retry limit, remaining retries, and the cooldown before the next retry.
 * @throws {SymmApiError} `RETRY_LISTING_FAILED` when the endpoint request fails — including a `401` on a bad or expired token, and the service's rejection when no retries remain or the cooldown has not elapsed, which surface with the service's message and status as-is.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide the retry flow instead.
 *
 * @example
 * ```ts
 * const left = await retryListing(config, {
 *   accessToken: token.accessToken,
 *   tokenContractAddress: rejectedMarket.contractAddress,
 *   depositChain: rejectedMarket.chainId,
 * });
 * ```
 */
export async function retryListing(
  config: Config,
  parameters: RetryListingParameters,
): Promise<RetryListingReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  try {
    const response = await retryListingV2MarketRetryListingPost(
      {
        token_contract_address: parameters.tokenContractAddress,
        deposit_chain: parameters.depositChain as unknown as SupportedDepositChains,
      },
      { baseURL, headers: { Authorization: `Bearer ${parameters.accessToken}` } },
    );

    return toRetryListingResult(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "RETRY_LISTING_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "RETRY_LISTING_FAILED",
      `Failed to retry market listing: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
