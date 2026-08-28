import { toInventoryTvl } from "../tvl/get-inventory-tvl";
import type { InventoryTvlPoint } from "../types";
import type { MarketHistoricalTVLPointResponse } from "../types/generated/inventory-service";

/**
 * Map one raw `MarketHistoricalTVLPointResponse` row into the SDK's
 * {@link InventoryTvlPoint}.
 *
 * `tvl` arrives as an 18-decimal decimal **string** and is parsed with the same
 * {@link toInventoryTvl} the aggregate read uses, so a malformed or absent value
 * collapses to `0n` instead of throwing — one bad snapshot must not take down a
 * whole chart.
 *
 * @param raw - One row of the service's `tvl-history` response.
 * @returns The normalized point.
 */
export function toInventoryTvlPoint(raw: MarketHistoricalTVLPointResponse): InventoryTvlPoint {
  return {
    timestamp: raw.timestamp,
    tvl: toInventoryTvl(raw.tvl),
  };
}
