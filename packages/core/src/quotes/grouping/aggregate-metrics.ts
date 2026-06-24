import { WEI } from "../../shared/utils/wei";
import type { LockedValues } from "../../symmio-contracts/symmio/types";
import type { UnifiedQuote } from "../unified-quote";
import { isActivePosition, isPendingOrder } from "./partition-quotes";
import type { QuoteGroupMetrics } from "./quote-group";

/** A quote's open price for valuation: the settled `openedPrice`, else the requested one. */
function openPriceOf(quote: UnifiedQuote): bigint {
  return quote.openedPrice !== undefined && quote.openedPrice !== 0n ? quote.openedPrice : quote.requestedOpenPrice;
}

/** Whether a quote still lacks a settled open price (a pending or optimistic open). */
function hasUnsettledOpenPrice(quote: UnifiedQuote): boolean {
  return quote.openedPrice === undefined || quote.openedPrice === 0n;
}

/**
 * Compute the pure, price-independent {@link QuoteGroupMetrics} for a set of
 * child quotes.
 *
 * - `openQuantity` / `quantity` are plain sums (wei).
 * - `notional = Σ(openQuantity × openPrice)`, rescaled to wei.
 * - `weightedOpenPrice = notionalₙᵤₘ / Σ openQuantity`, suppressed (`undefined`)
 *   when there is no open size or any child has an unsettled open price.
 * - `lockedValues` sums each margin leg.
 * - `leverage = notional / (Σ cva + lf + partyAmm)`, as an 18-decimal fixed-point
 *   `bigint`, `undefined` when that margin is `0`.
 *
 * Pure and order-independent. Empty input yields all-zero amounts with the
 * optional fields `undefined`.
 *
 * @param quotes - The group's child quotes.
 * @returns The aggregated metrics.
 */
export function aggregateGroupMetrics(quotes: readonly UnifiedQuote[]): QuoteGroupMetrics {
  let quantity = 0n;
  let openQuantity = 0n;
  /** Σ(openQuantity × openPrice), scaled by `WEI²` until the final rescale. */
  let notionalNumerator = 0n;
  let cva = 0n;
  let lf = 0n;
  let partyAmm = 0n;
  let partyBmm = 0n;
  let openCount = 0;
  let pendingCount = 0;
  let anyUnsettledOpenPrice = false;

  for (const quote of quotes) {
    quantity += quote.quantity;
    openQuantity += quote.openQuantity;
    notionalNumerator += quote.openQuantity * openPriceOf(quote);
    cva += quote.lockedValues.cva;
    lf += quote.lockedValues.lf;
    partyAmm += quote.lockedValues.partyAmm;
    partyBmm += quote.lockedValues.partyBmm;
    if (hasUnsettledOpenPrice(quote)) anyUnsettledOpenPrice = true;
    if (isPendingOrder(quote)) pendingCount += 1;
    else if (isActivePosition(quote)) openCount += 1;
  }

  const lockedValues: LockedValues = { cva, lf, partyAmm, partyBmm };
  const notional = notionalNumerator / WEI;
  const partyAMargin = cva + lf + partyAmm;

  const weightedOpenPrice = openQuantity > 0n && !anyUnsettledOpenPrice ? notionalNumerator / openQuantity : undefined;
  const leverage = partyAMargin > 0n ? (notional * WEI) / partyAMargin : undefined;

  return {
    quoteCount: quotes.length,
    openCount,
    pendingCount,
    quantity,
    openQuantity,
    weightedOpenPrice,
    notional,
    lockedValues,
    leverage,
  };
}
