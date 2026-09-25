import { PositionType, QuoteCloseEventType, type QuoteHistoryRow } from "@symmio/trading-core";
import { WEI_DECIMALS } from "@symmio/utils";
import { formatUnits } from "viem";

/** The three event types that terminate a position by liquidation. */
const LIQUIDATION_EVENTS: ReadonlySet<QuoteCloseEventType> = new Set([
  QuoteCloseEventType.LiquidatePartyA,
  QuoteCloseEventType.LiquidatePartyB,
  QuoteCloseEventType.LiquidateClearingHouse,
]);

/** Whether this row was produced by a liquidation rather than a close. */
export function isLiquidation(row: QuoteHistoryRow): boolean {
  return LIQUIDATION_EVENTS.has(row.closeEventType);
}

/**
 * The size this event actually settled — the number every other figure on the
 * row is derived from.
 *
 * A liquidation reports its size on `liquidateAmount`; a close reports it on
 * `quantityToClose` (which the SDK overlays with the event's own `metadata`
 * snapshot, so a partial close carries that partial's size rather than the
 * quote's final state). `quantity` is the whole-quote fallback for a row that
 * carried no snapshot.
 */
export function closeSizeOf(row: QuoteHistoryRow): bigint {
  if (isLiquidation(row)) return row.liquidateAmount;
  return row.quantityToClose > 0n ? row.quantityToClose : row.quantity;
}

/** A row's settled size as a plain number (18-decimal wei → units). */
export function closeSizeNumber(row: QuoteHistoryRow): number {
  return Number(formatUnits(closeSizeOf(row), WEI_DECIMALS));
}

/** A row's open price as a plain number. */
export function openPriceNumber(row: QuoteHistoryRow): number {
  return Number(formatUnits(row.openedPrice, WEI_DECIMALS));
}

/** A row's close price as a plain number — the liquidation price on a liquidation. */
export function closePriceNumber(row: QuoteHistoryRow): number {
  return Number(formatUnits(row.avgClosedPrice, WEI_DECIMALS));
}

/**
 * Realized PnL in quote-currency USD for the portion this event closed:
 * `size × (close − open)`, signed by side.
 *
 * `QuoteHistoryRow` carries no PnL field, so it is derived here from the
 * snapshot-overlaid prices and size — which is what makes each partial-close row
 * report its own result instead of the quote's final one.
 */
export function realizedPnlOf(row: QuoteHistoryRow): number {
  const size = closeSizeNumber(row);
  const open = openPriceNumber(row);
  const close = closePriceNumber(row);
  const sign = row.positionType === PositionType.LONG ? 1 : -1;
  return (close - open) * size * sign;
}
