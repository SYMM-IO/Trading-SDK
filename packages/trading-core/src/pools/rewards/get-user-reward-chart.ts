import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { UserPoolRewardChart } from "../types";
import { getUserRewardChartV2ProfitChartRewardsGet } from "../types/generated/listing-backend";
import { toUserPoolRewardChart } from "./to-pool-reward-point";

/**
 * Parameters for {@link getUserRewardChart}.
 *
 * The endpoint takes no market: it reports **every** market the signed-in user
 * has rewards in, identified by the bearer token alone.
 */
export type GetUserRewardChartParameters = Compute<
  ChainIdParameter & {
    /**
     * Bearer token from `authenticateListing`; required — the endpoint is authed.
     * Sent as the `Authorization: Bearer <token>` header; a bad or expired token
     * yields a `401`.
     */
    accessToken: string;
  }
>;

/**
 * Return type of {@link getUserRewardChart}: one entry per market the user has
 * rewards in.
 */
export type GetUserRewardChartReturnType = UserPoolRewardChart[];

/**
 * Fetch the signed-in user's daily LP-reward series, grouped by market — the
 * "your performance" side of a pool page's rewards chart.
 *
 * Authed and **not** scoped to one pool: the response covers every market the
 * user has rewards in, so a single-pool view filters the result by
 * `(marketAddress, marketChainId)`. Each point's `reward` is a `bigint` at
 * `LISTING_VALUE_DECIMALS` (18), in USD.
 *
 * @param config - The SDK config.
 * @param parameters - The bearer token plus an optional chain id.
 * @returns One {@link UserPoolRewardChart} per market with rewards.
 * @throws {SymmApiError} when the endpoint request fails, including a `401` on a bad or expired token.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide Pools instead.
 *
 * @example
 * ```ts
 * const charts = await getUserRewardChart(config, { accessToken: token.accessToken });
 * const pool = charts.find(
 *   (entry) => entry.marketAddress.toLowerCase() === address.toLowerCase(),
 * );
 * ```
 */
export async function getUserRewardChart(
  config: Config,
  parameters: GetUserRewardChartParameters,
): Promise<GetUserRewardChartReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  try {
    const response = await getUserRewardChartV2ProfitChartRewardsGet({
      baseURL,
      headers: { Authorization: `Bearer ${parameters.accessToken}` },
    });

    return (response.data ?? []).map(toUserPoolRewardChart);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_USER_REWARD_CHART_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_USER_REWARD_CHART_FAILED",
      `Failed to fetch user reward chart: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
