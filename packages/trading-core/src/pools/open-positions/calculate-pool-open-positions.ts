import { calculateLiquidationPrice } from "../../quotes/liquidation/calculate-liquidation-price";
import { calculateQuoteLeverage } from "../../quotes/upnl/calculate-quote-leverage";
import { calculateQuoteUpnl } from "../../quotes/upnl/calculate-quote-upnl";
import type { AccountBalanceInfo } from "../../symmio-contracts/account-layer/types";
import { PositionType } from "../../symmio-contracts/symmio/types";
import { units, type PoolReadGap } from "../composition";
import type { PoolQuote } from "../types";

/** Normalized quote and account reads for the pool's open positions. */
export interface CalculatePoolOpenPositionsParameters {
  quotes: readonly PoolQuote[];
  balances: Readonly<Record<string, AccountBalanceInfo | null>>;
  /** External/current mark price in USD. Omit when unknown. */
  priceUsd?: number;
  /** Set false when quotes are only a page; incomplete accounts cannot yield liquidation estimates. */
  complete?: boolean;
  gaps?: readonly PoolReadGap[];
}

/** Calculate table metrics using the shared SDK quote primitives.
 * @param input - SDK quotes, account balances and optional mark price.
 * @returns Quote fields plus metrics; priceChangePercent is deliberately unleveraged.
 */
export function calculatePoolOpenPositions(input: CalculatePoolOpenPositionsParameters) {
  const price = input.priceUsd != null && Number.isFinite(input.priceUsd) && input.priceUsd > 0 ? input.priceUsd : null;
  const entries = input.quotes.map((quote) => {
    const openedPrice =
      [quote.openedPrice, quote.initialOpenedPrice, quote.requestedOpenPrice].find(
        (value) => value != null && value > 0n,
      ) ?? null;
    const quantity =
      quote.quantity == null || quote.closedAmount == null
        ? null
        : quote.quantity > quote.closedAmount
          ? quote.quantity - quote.closedAmount
          : 0n;
    const leverage = poolLeverage(quote, openedPrice);
    const positionType = Number(quote.positionType) === PositionType.SHORT ? PositionType.SHORT : PositionType.LONG;
    const pnl =
      price == null || openedPrice == null || quantity == null
        ? null
        : calculateQuoteUpnl({
            markPrice: String(price),
            positionType,
            quantity,
            closedAmount: 0n,
            openedPrice,
            leverage: "1",
          });
    const account = quote.partyA.toLowerCase();
    const balance = input.balances[account];
    const accountQuotes = input.quotes.filter((row) => row.partyA.toLowerCase() === account);
    const positions = accountQuotes.flatMap((row) =>
      row.quantity == null || row.closedAmount == null || row.openedPrice == null
        ? []
        : [{ quantity: row.quantity, closedAmount: row.closedAmount, openedPrice: row.openedPrice }],
    );
    const compatible = accountQuotes.every(
      (row) => row.symbolId === quote.symbolId && Number(row.positionType) === Number(quote.positionType),
    );
    const liquidationPrice =
      balance && input.complete !== false && compatible && positions.length === accountQuotes.length
        ? calculateLiquidationPrice({ ...balance, positions, positionType })
        : null;
    return {
      ...quote,
      remainingQuantity: quantity,
      entryPrice: openedPrice,
      positionValueUsd: quantity == null || price == null ? null : units(quantity)! * price,
      leverageMultiplier: leverage,
      upnlUsd: pnl ? Number(pnl.upnl) : null,
      priceChangePercent: pnl ? Number(pnl.upnlPercent) : null,
      liquidationPrice,
      openedAt:
        [quote.timestampOpenPosition, quote.timestampSendQuote, quote.timestamp].find(
          (value) => value != null && value > 0,
        ) ?? null,
    };
  });
  return { entries, gaps: [...(input.gaps ?? [])] };
}
/** Pool open-position table projection. */
export type PoolOpenPositions = ReturnType<typeof calculatePoolOpenPositions>;

/** Preserve the pool table's legacy integer leverage inference when the backend omits leverage. */
function poolLeverage(quote: PoolQuote, openedPrice: bigint | null): number | null {
  if (quote.leverage != null && quote.leverage > 0n) return units(quote.leverage);
  if (quote.initialCva == null || quote.initialLf == null || quote.initialPartyAmm == null) return null;
  const margin = quote.initialCva + quote.initialLf + quote.initialPartyAmm;
  if (margin <= 0n) return null;
  if (quote.initialLf > 0n)
    return Math.max(1, Math.round(Number((quote.initialLf * 100n * 10n ** 18n) / margin) / 1e18));
  if (quote.quantity == null || quote.quantity <= 0n || openedPrice == null) return null;
  const candidate = (price: bigint) =>
    Number(
      calculateQuoteLeverage({
        quantity: quote.quantity!,
        openedPrice: price,
        requestedOpenPrice: price,
        lockedValues: { cva: quote.initialCva!, lf: quote.initialLf!, partyAmm: quote.initialPartyAmm!, partyBmm: 0n },
      }),
    );
  const opened = candidate(openedPrice);
  const requested =
    quote.requestedOpenPrice != null && quote.requestedOpenPrice > 0n ? candidate(quote.requestedOpenPrice) : opened;
  return Math.max(
    1,
    Math.round(
      Math.abs(requested - Math.round(requested)) < Math.abs(opened - Math.round(opened)) ? requested : opened,
    ),
  );
}
