/**
 * Fixed-point scale of the inventory service's value fields.
 *
 * The service reports them as decimal **strings** at 18 decimals
 * (`"630232531461381896637475"` = `630232.53...`), independent of any token's own
 * decimals. The SDK keeps them as `bigint` at this scale so nothing is lost;
 * format with `formatUnits(value, INVENTORY_VALUE_DECIMALS)` from
 * `@symmio/utils/decimal` at the display edge.
 *
 * Unlike the listing backend's rate fields, every inventory value here is a USD
 * amount — `1e18` is `$1`.
 */
export const INVENTORY_VALUE_DECIMALS = 18;

/**
 * One point of a market's custodial TVL history.
 *
 * The inventory service snapshots each market's held value on a schedule; a
 * series of these is what a pool page's TVL chart plots.
 */
export interface InventoryTvlPoint {
  /** Snapshot time, unix **seconds**. */
  timestamp: number;
  /**
   * Value held at that moment, `bigint` at {@link INVENTORY_VALUE_DECIMALS} (18).
   * A USD amount — `1e18` is `$1`.
   */
  tvl: bigint;
}
