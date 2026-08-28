import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { toListingValue } from "../markets/to-listing-market";
import { resolveListingService } from "../resolve-listing";
import { getUserTotalRewardV2ProfitTotalRewardGet } from "../types/generated/listing-backend";

/** Parameters for {@link getUserTotalReward}. */
export type GetUserTotalRewardParameters = Compute<
  ChainIdParameter & {
    /**
     * Bearer token from `authenticateListing`; required — the endpoint is authed.
     * Sent as the `Authorization: Bearer <token>` header; a bad or expired token
     * yields a `401`.
     */
    accessToken: string;
    /**
     * The user's wallet address. Required: the endpoint takes it as a query
     * parameter even though the bearer token already identifies the session.
     */
    userAddress: string;
    /**
     * Size of the trailing window in days. The service accepts **1–30**; a value
     * outside that range is rejected with a `422`. Required.
     */
    days: number;
  }
>;

/**
 * Return type of {@link getUserTotalReward}: the aggregate reward as a `bigint`
 * at `LISTING_VALUE_DECIMALS` (18).
 */
export type GetUserTotalRewardReturnType = bigint;

/**
 * Fetch the signed-in user's aggregate LP reward over the last `days`, across
 * **every** market they have rewards in.
 *
 * The figure is built from earned daily snapshots, so claiming does not reduce
 * it — it is lifetime-earned within the window, not an unclaimed balance. Use
 * `getUserProfit` for the claimable figure. Money at
 * `LISTING_VALUE_DECIMALS` (18): the descaled number is USD (`1e18` = `$1`), and
 * an absent figure comes back as `0n`.
 *
 * @param config - The SDK config.
 * @param parameters - The bearer token, the user's address, the window in days, plus an optional chain id.
 * @returns Aggregate reward, 18-decimal fixed point.
 * @throws {SymmApiError} when the endpoint request fails, including a `401` on a bad token and a `422` on a `days` outside 1–30.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide Pools instead.
 *
 * @example
 * ```ts
 * const earned30d = await getUserTotalReward(config, {
 *   accessToken: token.accessToken,
 *   userAddress: account.address,
 *   days: 30,
 * });
 * ```
 */
export async function getUserTotalReward(
  config: Config,
  parameters: GetUserTotalRewardParameters,
): Promise<GetUserTotalRewardReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  try {
    const response = await getUserTotalRewardV2ProfitTotalRewardGet(
      { user_address: parameters.userAddress, days: parameters.days },
      { baseURL, headers: { Authorization: `Bearer ${parameters.accessToken}` } },
    );

    return toListingValue(response.data?.total_reward) ?? 0n;
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_USER_TOTAL_REWARD_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_USER_TOTAL_REWARD_FAILED",
      `Failed to fetch user total reward: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
