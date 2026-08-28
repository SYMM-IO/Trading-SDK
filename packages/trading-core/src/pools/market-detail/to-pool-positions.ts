import type { ListingMarketDetail, PoolPosition } from "../types";

/**
 * Fold a pool's detail into the rows a positions table renders — long first,
 * then short.
 *
 * A pool's inventory is not a list of trades: the backend reports one aggregate
 * per side, so this is a pure reshape of {@link ListingMarketDetail}, not a
 * second request. Sides the backend reported nothing for are omitted, so an
 * empty array means the pool holds no inventory at all.
 *
 * @param detail - The pool detail to fold.
 * @returns The present sides, long before short.
 *
 * @example
 * ```ts
 * const detail = await getListingMarketDetail(config, { tokenContractAddress, depositChain });
 * for (const row of toPoolPositions(detail)) {
 *   console.log(row.side, row.size, row.upnl);
 * }
 * ```
 */
export function toPoolPositions(detail: ListingMarketDetail): PoolPosition[] {
  return [detail.longPosition, detail.shortPosition].filter((position): position is PoolPosition => position !== null);
}
