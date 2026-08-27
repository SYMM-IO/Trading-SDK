import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import { withdrawV2MarketWithdrawPost } from "../types/generated/listing-backend";
import { toWithdrawRequest } from "./to-withdraw-request";

/**
 * Parameters for {@link withdrawLp}.
 *
 * Pool listing is chain-level, so this takes only a `chainId`: the listing
 * backend is resolved from the chain. Every other field is required — the
 * endpoint is authed and the service needs the amount, the market, and where to
 * send the withdrawn liquidity.
 */
export type WithdrawLpParameters = Compute<
  ChainIdParameter & {
    /**
     * Bearer token from `authenticateListing`; required — the endpoint is authed.
     * Sent as the `Authorization: Bearer <token>` header; a bad or expired token
     * yields a `401`.
     */
    accessToken: string;
    /**
     * The pool's token contract address — the id that addresses a single market
     * in the listing API. An EVM `0x…` address, or a Solana base58 address for a
     * Solana-deposited listing.
     */
    marketAddress: string;
    /**
     * Destination address the withdrawn liquidity is sent to — an EVM `0x…`
     * address, or a Solana base58 address for a Solana-deposited listing.
     */
    withdrawAddress: string;
    /**
     * LP shares to withdraw, as a raw integer at `LISTING_VALUE_DECIMALS` (18) —
     * the same scale `UserPoolProfit.userLpAmount` is reported in. Must not exceed
     * `UserPoolProfit.availableLpAmount`; the shares already queued in
     * `pendingWithdrawLpAmount` are spoken for.
     */
    amount: bigint;
    /** Optional free-text note attached to the withdrawal request. Sent only when set. */
    description?: string;
  }
>;

/**
 * Return type of {@link withdrawLp}: `void`. The listing backend acknowledges a
 * queued withdrawal with an empty `200` body, so there is nothing to normalize.
 */
export type WithdrawLpReturnType = void;

/**
 * Queue a withdrawal of LP shares from a pool — POST an amount, the market, and a
 * destination address to the permissionless listing service.
 *
 * POSTs to `/v2/market/withdraw` with the caller's bearer token. The service
 * records the request and moves the shares into the pool's pending-withdrawal
 * queue — after this resolves, a fresh `getUserProfit` read shows the amount in
 * `pendingWithdrawLpAmount` and a correspondingly lower `availableLpAmount`. The
 * endpoint returns an empty body, so this resolves to `void`. Enigma-only.
 *
 * @param config - The SDK config.
 * @param parameters - The bearer token, LP amount, market address, destination address, and an optional note.
 * @returns Nothing — resolves once the service accepts the request.
 * @throws {SymmApiError} `WITHDRAW_LP_FAILED` when the endpoint request fails — including a `401` on a bad or expired token, and the service's rejections (e.g. an amount above the available LP), which surface with the service's message and status as-is.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide the withdrawal flow
 *   instead.
 *
 * @example
 * ```ts
 * await withdrawLp(config, {
 *   accessToken: token.accessToken,
 *   marketAddress: "0xToken…",
 *   withdrawAddress: "0xRecipient…",
 *   amount: profit.availableLpAmount, // never more than this
 * });
 * ```
 */
export async function withdrawLp(config: Config, parameters: WithdrawLpParameters): Promise<void> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  try {
    await withdrawV2MarketWithdrawPost(toWithdrawRequest(parameters), {
      baseURL,
      headers: { Authorization: `Bearer ${parameters.accessToken}` },
    });
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "WITHDRAW_LP_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "WITHDRAW_LP_FAILED",
      `Failed to withdraw LP: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
