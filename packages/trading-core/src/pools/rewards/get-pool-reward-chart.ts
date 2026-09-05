import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { resolveListingService } from "../resolve-listing";
import type { ListingDepositChainId, PoolRewardPoint } from "../types";
import { getMarketRewardChartV2MarketChartRewardsGet } from "../types/generated/listing-backend";
import { toPoolRewardPoint } from "./to-pool-reward-point";

/**
 * Parameters for {@link getPoolRewardChart}.
 *
 * A pool is addressed by the pair `(marketAddress, marketChainId)`. The separate
 * `chainId` is the SDK's own — it selects which deployment's listing backend to
 * ask, and is unrelated to the chain the pool's token lives on.
 */
export type GetPoolRewardChartParameters = Compute<
  ChainIdParameter & {
    /** The pool's token contract address — `ListingMarket.contractAddress`. Required. */
    marketAddress: string;
    /** Chain the pool's token lives on — `ListingMarket.chainId`. Required. */
    marketChainId: ListingDepositChainId;
  }
>;

/**
 * Return type of {@link getPoolRewardChart}: one point per reward day, in the
 * order the service returns them (oldest first).
 */
export type GetPoolRewardChartReturnType = PoolRewardPoint[];

/**
 * Fetch a pool's daily LP-reward series — the public series behind a pool page's
 * rewards chart.
 *
 * Public: no bearer token. Each point's `reward` is a `bigint` at
 * `LISTING_VALUE_DECIMALS` (18) and is **money**, so the descaled figure is a USD
 * amount (`1e18` = `$1`), not a percentage. A pool with no snapshots answers with
 * an empty series rather than an error, so an empty array means "nothing to plot
 * yet", not "something went wrong".
 *
 * @param config - The SDK config.
 * @param parameters - The pool's address and token chain, plus an optional SDK chain id.
 * @returns One {@link PoolRewardPoint} per reward day.
 * @throws {SymmApiError} when the API request fails.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide Pools instead.
 *
 * @example
 * ```ts
 * const rewards = await getPoolRewardChart(config, {
 *   marketAddress: "0x1234…",
 *   marketChainId: ListingDepositChainId.BASE,
 * });
 * const total = rewards.reduce((sum, point) => sum + point.reward, 0n);
 * ```
 */
export async function getPoolRewardChart(
  config: Config,
  parameters: GetPoolRewardChartParameters,
): Promise<GetPoolRewardChartReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  try {
    const response = await getMarketRewardChartV2MarketChartRewardsGet(
      { market_address: parameters.marketAddress, chain_id: parameters.marketChainId },
      { baseURL },
    );

    return (response.data ?? []).map(toPoolRewardPoint);
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_POOL_REWARD_CHART_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_POOL_REWARD_CHART_FAILED",
      `Failed to fetch pool reward chart: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
