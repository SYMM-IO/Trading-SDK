import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { ListingDepositChainId, PoolClaimResult } from "../types";
import { claimProfitV2ClaimPost } from "../types/generated/listing-backend";
import { toClaimRequest } from "./to-claim-request";
import { toClaimResult } from "./to-claim-result";

/**
 * Parameters for {@link claimProfit}.
 *
 * Pool listing is chain-level, so this takes only a `chainId`: the listing
 * backend is resolved from the chain. Every other field is required — the
 * endpoint is authed and the service needs the amount, the market, the deposit
 * chain, and the sub-account to credit.
 */
export type ClaimProfitParameters = Compute<
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
    tokenContractAddress: string;
    /**
     * The chain the pool's liquidity was deposited on — the market's
     * {@link ListingMarket.chainId}. Sent as `deposit_chain`; the service uses it
     * to route the USDC transfer.
     */
    depositChain: ListingDepositChainId;
    /**
     * The sub-account address to credit the claimed USDC to. Must be a sub-account
     * the caller owns; the service rejects an address it does not.
     */
    accountAddress: string;
    /**
     * USDC to claim, as a raw integer at `LISTING_VALUE_DECIMALS` (18) — the same
     * scale `UserPoolProfit.claimableReward` is reported in. Must not exceed
     * `UserPoolProfit.claimableReward`; the service rejects an over-claim.
     */
    amount: bigint;
  }
>;

/**
 * Return type of {@link claimProfit}: the claim receipt. Unlike `withdrawLp`, the
 * claim is synchronous and the service returns a body — the moved amount, a claim
 * id to reference it, and the transfer's transaction hash.
 */
export type ClaimProfitReturnType = PoolClaimResult;

/**
 * Claim a pool's accrued LP rewards as USDC — POST an amount, the market, the
 * deposit chain, and a destination sub-account to the permissionless listing
 * service.
 *
 * POSTs to `/v2/claim` with the caller's bearer token. The claim is synchronous:
 * the service moves USDC to `accountAddress` and returns a {@link PoolClaimResult}
 * receipt. After it resolves, a fresh `getUserProfit` read shows a lower
 * `claimableReward` and a correspondingly higher `claimedReward`. Enigma-only.
 *
 * @param config - The SDK config.
 * @param parameters - The bearer token, USDC amount, market address, deposit chain, and destination sub-account.
 * @returns The claim receipt: status, amount claimed, claim id, and transfer transaction hash.
 * @throws {SymmApiError} `CLAIM_PROFIT_FAILED` when the endpoint request fails — including a `401` on a bad or expired token, and the service's rejections (e.g. an amount above the claimable reward, or the per-day claim cap), which surface with the service's message and status as-is.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide the claim flow instead.
 *
 * @example
 * ```ts
 * const receipt = await claimProfit(config, {
 *   accessToken: token.accessToken,
 *   tokenContractAddress: "0xToken…",
 *   depositChain: market.chainId,
 *   accountAddress: "0xSubAccount…",
 *   amount: profit.claimableReward, // never more than this
 * });
 * ```
 */
export async function claimProfit(config: Config, parameters: ClaimProfitParameters): Promise<ClaimProfitReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  try {
    const response = await claimProfitV2ClaimPost(toClaimRequest(parameters), {
      baseURL,
      headers: { Authorization: `Bearer ${parameters.accessToken}` },
    });

    return toClaimResult(response.data);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "CLAIM_PROFIT_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "CLAIM_PROFIT_FAILED",
      `Failed to claim pool profit: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
