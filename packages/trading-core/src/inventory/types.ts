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
