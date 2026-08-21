"use client";

import type { PrismMarket } from "@/features/markets/types";
import { useMarkTick } from "@/features/prices/price-provider";
import { calculateQuoteLeverage, calculateQuoteUpnl } from "@symmio/trading-core";
import { useMemo } from "react";
import type { PrismQuote } from "./positions-provider";

export interface QuoteMetrics {
  /** Live mark for this row's market. `undefined` until its feed ticks. */
  mark?: number;
  /** Unrealized P&L in dollars, or `undefined` when the row is unpriced. */
  upnl?: number;
  /** Unrealized P&L against the margin behind the position, in percent. */
  upnlPercent?: number;
  /** Leverage implied by the quote's own locked-margin breakdown. */
  leverage: number;
}

/**
 * What one blotter row is worth right now, priced on **its own** deployment.
 *
 * `useQuoteUpnlAndPnl` is the SDK's answer to this and it is the right one for
 * a single-deployment app — but it resolves the price feed from the *connected*
 * chain, and Prism shows two deployments side by side while the wallet can only
 * be on one. Sitting on Base, that hook priced a lowcap position off Binance's
 * BTC tick and reported sixteen million dollars of profit on a $1.90 position.
 *
 * So the pricing is pinned to the row's own market family — Prism already
 * streams both feeds — and handed to `@symmio/trading-core`'s pure calculators,
 * which is where the arithmetic lived all along. An unpriced row reports
 * `undefined` rather than `0`: "no tick yet" and "flat" are different facts, and
 * only one of them is worth showing as a number.
 */
export function useQuoteMetrics(row: PrismQuote, market?: PrismMarket): QuoteMetrics {
  const tick = useMarkTick(row.family, market?.market.name ?? "");
  const markPrice = tick?.markPrice;

  return useMemo(() => {
    const quote = row.quote;
    /* Leverage comes off the margin the quote locked, so it is known without a
       price — an unpriced row still says how leveraged it is. */
    const leverage = calculateQuoteLeverage({
      quantity: quote.quantity,
      requestedOpenPrice: quote.requestedOpenPrice,
      openedPrice: quote.openedPrice,
      lockedValues: quote.initialLockedValues ?? quote.lockedValues,
    });
    const metrics: QuoteMetrics = { leverage: Number(leverage) };

    const mark = markPrice === undefined ? undefined : Number(markPrice);
    if (markPrice === undefined || mark === undefined || !Number.isFinite(mark)) return metrics;

    /* A quote that has not been filled has no entry to measure against, and
       `0n` is how the chain says so on a `PENDING` / `LOCKED` row. Passing that
       through prices the position against an entry of zero, which reports the
       entire notional as profit — an 8 XRP order that had never opened read
       `+$11.19`. The mark is still returned; only the P&L is withheld. */
    const settledOpen = quote.openedPrice !== undefined && quote.openedPrice !== 0n ? quote.openedPrice : undefined;
    if (settledOpen === undefined) return { ...metrics, mark };

    const { upnl, upnlPercent } = calculateQuoteUpnl({
      markPrice,
      positionType: quote.positionType,
      quantity: quote.quantity,
      closedAmount: quote.closedAmount ?? 0n,
      openedPrice: settledOpen,
      leverage,
    });

    return { ...metrics, mark, upnl: Number(upnl), upnlPercent: Number(upnlPercent) };
  }, [row.quote, markPrice]);
}
