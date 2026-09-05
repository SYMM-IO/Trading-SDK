import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { ListingDepositChainId, RetryListingInfo } from "../types";
import {
  userRetryInfoV2MarketRetryListingInfoGet,
  type SupportedDepositChains,
} from "../types/generated/listing-backend";
import { toRetryListingInfo } from "./to-retry-listing-info";

/**
 * Parameters for {@link getRetryListingInfo}.
 *
 * Pool listing is chain-level, so this takes only a `chainId`: the listing
 * backend is resolved from the chain. The endpoint is authed and scoped to the
 * caller — it reports the current user's remaining retries for one market.
 */
export type GetRetryListingInfoParameters = Compute<
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

/** Return type of {@link getRetryListingInfo}: the user's retry allowance for one market. */
export type GetRetryListingInfoReturnType = RetryListingInfo;

/**
 * Fetch the signed-in user's **retry allowance** for a rejected market — how many
 * listing retries remain and how long they must wait before the next one.
 *
 * Hits the authed `/v2/market/retry-listing-info` endpoint with the caller's
 * bearer token. Read this before offering {@link retryListing}: gate the retry
 * button on `remainingRetries > 0` and on `remainingCooldownSeconds` being `null`
 * or `0`. Enigma-only.
 *
 * @param config - The SDK config.
 * @param parameters - The bearer token, the market's token contract address, and its deposit chain.
 * @returns The {@link RetryListingInfo}: retry limit, remaining retries, and remaining cooldown.
 * @throws {SymmApiError} `FETCH_RETRY_LISTING_INFO_FAILED` when the endpoint request fails, including a `401` on a bad or expired token.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide the retry flow instead.
 *
 * @example
 * ```ts
 * const info = await getRetryListingInfo(config, {
 *   accessToken: token.accessToken,
 *   tokenContractAddress: rejectedMarket.contractAddress,
 *   depositChain: rejectedMarket.chainId,
 * });
 * ```
 */
export async function getRetryListingInfo(
  config: Config,
  parameters: GetRetryListingInfoParameters,
): Promise<GetRetryListingInfoReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  try {
    const response = await userRetryInfoV2MarketRetryListingInfoGet(
      {
        token_contract_address: parameters.tokenContractAddress,
        deposit_chain: parameters.depositChain as unknown as SupportedDepositChains,
      },
      { baseURL, headers: { Authorization: `Bearer ${parameters.accessToken}` } },
    );

    return toRetryListingInfo(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_RETRY_LISTING_INFO_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_RETRY_LISTING_INFO_FAILED",
      `Failed to fetch retry listing info: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
