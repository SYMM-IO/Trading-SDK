import { PositionType, type UnifiedQuote } from "@symmio/trading-core";
import { formatUnits } from "viem";

export interface PositionPnl {
  entryPrice: number;
  quantity: number;
  notionalUsd: number;
  marginUsd: number;
  uPnlUsd: number;
  uPnlPct: number;
  leverage: number;
}

/**
 * Live PnL for a position from its unified quote and the current mark price.
 * Prices/quantities on the quote are 18-dec wei; PnL is quote-currency USD, and
 * the percentage is measured against locked margin (CVA + LF).
 */
export function computePnl(quote: UnifiedQuote, markPrice: number | null): PositionPnl {
  const entryPrice = Number(formatUnits(quote.openedPrice ?? quote.requestedOpenPrice, 18));
  const quantity = Number(formatUnits(quote.openQuantity, 18));
  const isLong = quote.positionType === PositionType.LONG;
  const marginUsd = Number(formatUnits(quote.lockedValues.cva + quote.lockedValues.lf, 18));
  const notionalUsd = entryPrice * quantity;
  const uPnlUsd = markPrice != null ? (markPrice - entryPrice) * quantity * (isLong ? 1 : -1) : 0;
  const uPnlPct = marginUsd > 0 ? (uPnlUsd / marginUsd) * 100 : 0;
  const leverage = marginUsd > 0 ? notionalUsd / marginUsd : 0;
  return { entryPrice, quantity, notionalUsd, marginUsd, uPnlUsd, uPnlPct, leverage };
}
