import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { ListingDepositChainId, PoolRefundResult } from "../types";
import { refundV2MarketRefundPost } from "../types/generated/listing-backend";
import { toRefundRequest } from "./to-refund-request";
import { toRefundResult } from "./to-refund-result";

/**
 * Parameters for {@link refundMarket}.
 *
 * Pool listing is chain-level, so this takes only a `chainId`: the listing
 * backend is resolved from the chain. The endpoint is authed and scoped to the
 * caller — a user may only refund their own deposit on a rejected market.
 */
export type RefundMarketParameters = Compute<
  ChainIdParameter & {
    /**
     * Bearer token from `authenticateListing`; required — the endpoint is authed.
     * Sent as the `Authorization: Bearer <token>` header; a bad or expired token
     * yields a `401`.
     */
    accessToken: string;
    /**
     * The rejected market's token contract address — the id that addresses a
     * single market in the listing API. An EVM `0x…` address, or a Solana base58
     * address for a Solana-deposited listing.
     */
    marketAddress: string;
    /**
     * The chain the deposit was made on — the market's
     * {@link ListingMarket.chainId}. Routes the refund transfer.
     */
    depositChain: ListingDepositChainId;
    /**
     * Destination address the refunded deposit is sent to — an EVM `0x…`
     * address, or a Solana base58 address for a Solana-deposited listing.
     */
    recipientAddress: string;
  }
>;

/**
 * Return type of {@link refundMarket}: the refund receipt — the on-chain transfer
 * hash.
 */
export type RefundMarketReturnType = PoolRefundResult;

/**
 * Refund a deposit on a **rejected** market — reclaim the funds a user deposited
 * into a market whose listing was rejected.
 *
 * POSTs to `/v2/market/refund` with the caller's bearer token. Use it only for a
 * market whose `marketStatus` is `REJECTED` (see {@link ListingMarketStatus}); the
 * service moves the deposit to `recipientAddress` and returns the transfer's
 * transaction hash. Enigma-only.
 *
 * @param config - The SDK config.
 * @param parameters - The bearer token, the rejected market's address, its deposit chain, and the recipient.
 * @returns The refund receipt: the on-chain transfer transaction hash.
 * @throws {SymmApiError} `REFUND_MARKET_FAILED` when the endpoint request fails — including a `401` on a bad or expired token, and the service's rejection when the market is not refundable (e.g. not rejected, or already refunded), which surface with the service's message and status as-is.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide the refund action instead.
 *
 * @example
 * ```ts
 * const receipt = await refundMarket(config, {
 *   accessToken: token.accessToken,
 *   marketAddress: rejectedMarket.contractAddress,
 *   depositChain: rejectedMarket.chainId,
 *   recipientAddress: account.address,
 * });
 * ```
 */
export async function refundMarket(
  config: Config,
  parameters: RefundMarketParameters,
): Promise<RefundMarketReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  try {
    const response = await refundV2MarketRefundPost(toRefundRequest(parameters), {
      baseURL,
      headers: { Authorization: `Bearer ${parameters.accessToken}` },
    });

    return toRefundResult(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "REFUND_MARKET_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "REFUND_MARKET_FAILED",
      `Failed to refund market deposit: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
