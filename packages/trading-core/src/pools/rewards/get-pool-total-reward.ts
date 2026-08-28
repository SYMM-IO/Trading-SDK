import { isAxiosError } from "axios";
import type { Config } from "../../core/config";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import type { ChainIdParameter, Compute } from "../../shared/types/properties";
import { toListingValue } from "../markets/to-listing-market";
import { resolveListingService } from "../resolve-listing";
import type { ListingDepositChainId } from "../types";
import { getMarketTotalRewardV2MarketTotalRewardGet } from "../types/generated/listing-backend";

/** Parameters for {@link getPoolTotalReward}. */
export type GetPoolTotalRewardParameters = Compute<
  ChainIdParameter & {
    /** The pool's token contract address — `ListingMarket.contractAddress`. Required. */
    marketAddress: string;
    /** Chain the pool's token lives on — `ListingMarket.chainId`. Required. */
    marketChainId: ListingDepositChainId;
    /**
     * Size of the trailing window in days. The service accepts **1–30**; a value
     * outside that range is rejected with a `422`. Required.
     */
    days: number;
  }
>;

/**
 * Return type of {@link getPoolTotalReward}: the aggregate reward as a `bigint`
 * at `LISTING_VALUE_DECIMALS` (18).
 */
export type GetPoolTotalRewardReturnType = bigint;

/**
 * Fetch a pool's aggregate LP reward over the last `days` — the headline figure
 * above a pool's rewards chart.
 *
 * Public: no bearer token. The result is **money** at
 * `LISTING_VALUE_DECIMALS` (18), so the descaled figure is a USD amount
 * (`1e18` = `$1`). An absent or unparseable figure comes back as `0n`, since a
 * pool with no reward snapshots has earned nothing rather than an unknown amount.
 *
 * @param config - The SDK config.
 * @param parameters - The pool's address and token chain, the window in days, plus an optional SDK chain id.
 * @returns Aggregate reward, 18-decimal fixed point.
 * @throws {SymmApiError} when the API request fails, including the `422` on a `days` outside 1–30.
 * @throws {SymmError} `LISTING_NOT_CONFIGURED` when the chain has no listing
 *   backend. Gate with `supportsListingService` to hide Pools instead.
 *
 * @example
 * ```ts
 * const reward30d = await getPoolTotalReward(config, {
 *   marketAddress: "0x1234…",
 *   marketChainId: ListingDepositChainId.BASE,
 *   days: 30,
 * });
 * formatUnits(reward30d, LISTING_VALUE_DECIMALS).toFixed(2); // "12.40"
 * ```
 */
export async function getPoolTotalReward(
  config: Config,
  parameters: GetPoolTotalRewardParameters,
): Promise<GetPoolTotalRewardReturnType> {
  const { url: baseURL } = resolveListingService(config, { chainId: parameters.chainId });

  try {
    const response = await getMarketTotalRewardV2MarketTotalRewardGet(
      {
        market_address: parameters.marketAddress,
        chain_id: parameters.marketChainId,
        days: parameters.days,
      },
      { baseURL },
    );

    return toListingValue(response.data?.total_reward) ?? 0n;
  } catch (err) {
    if (err instanceof SymmError) throw err;

    if (isAxiosError(err)) {
      throw SymmApiError.fromAxios(err, { code: "FETCH_POOL_TOTAL_REWARD_FAILED", baseURL });
    }

    throw new SymmError(
      "api",
      "FETCH_POOL_TOTAL_REWARD_FAILED",
      `Failed to fetch pool total reward: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err instanceof Error ? err : undefined },
    );
  }
}
