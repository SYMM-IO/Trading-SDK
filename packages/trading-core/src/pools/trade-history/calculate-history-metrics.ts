import { parseUnits } from "viem";
import { calculateClosePlatformFee } from "../../quotes/fees/calculate-close-platform-fee";
import { calculateOpenPlatformFee } from "../../quotes/fees/calculate-open-platform-fee";
import { calculateQuotePnl } from "../../quotes/upnl/calculate-quote-pnl";
import { PositionType, QuoteStatus } from "../../symmio-contracts/symmio/types";
import type { PoolQuote } from "../types";

/** Internal projection of an already snapshot-applied history quote. Unknown source amounts remain null. */
export function calculateHistoryMetrics(quote: PoolQuote) {
  const liquidated = quote.quoteStatus === QuoteStatus.LIQUIDATED;
  const closeQuantity = liquidated
    ? (quote.liquidateAmount ?? quote.closedAmount ?? quote.quantity)
    : (quote.closedAmount ?? quote.quantity);
  const closePrice = liquidated ? quote.liquidatePrice : (quote.averageClosedPrice ?? quote.closedPrice ?? null);
  const fillPrice =
    quote.initialOpenedPrice != null && quote.initialOpenedPrice > 0n ? quote.initialOpenedPrice : quote.openedPrice;
  const openFee =
    closeQuantity == null || fillPrice == null || quote.tradingFee == null
      ? null
      : calculateOpenPlatformFee({ quantity: closeQuantity, openedPrice: fillPrice, openFeeRate: quote.tradingFee });
  const closeFee = liquidated
    ? 0n
    : closeQuantity == null || closePrice == null || quote.closeFee == null
      ? null
      : calculateClosePlatformFee({ quantity: closeQuantity, closePrice, closeFeeRate: quote.closeFee });
  const positionType = quote.positionType;
  const realizedPnl =
    closeQuantity == null ||
    closePrice == null ||
    quote.openedPrice == null ||
    (positionType !== PositionType.LONG && positionType !== PositionType.SHORT)
      ? null
      : parseUnits(
          calculateQuotePnl({
            positionType,
            closedAmount: closeQuantity,
            closedPrice: closePrice,
            openedPrice: quote.openedPrice,
            leverage: "1",
          }).pnl,
          18,
        );
  return {
    closeQuantity,
    closePrice,
    tradeValue: closeQuantity == null || closePrice == null ? null : (closeQuantity * closePrice) / 10n ** 18n,
    openFee,
    closeFee,
    platformFee: openFee == null || closeFee == null ? null : openFee + closeFee,
    realizedPnl,
  };
}
