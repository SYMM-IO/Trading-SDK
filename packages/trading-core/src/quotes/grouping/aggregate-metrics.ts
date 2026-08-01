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

/** A quote's price for the frozen at-open notional: `initialOpenedPrice`, else the requested one. */
function initialNotionalPriceOf(quote: UnifiedQuote): bigint {
  return quote.initialOpenedPrice ?? quote.requestedOpenPrice;
}

/** A quote's reference price for leverage: `requestedOpenPrice`, else the settled `openedPrice`. */
function leveragePriceOf(quote: UnifiedQuote): bigint {
  return quote.requestedOpenPrice !== 0n ? quote.requestedOpenPrice : (quote.openedPrice ?? 0n);
}

/**
 * A quote's locked-margin basis for leverage: every leg (`cva + lf + partyAmm +
 * partyBmm`) of the frozen `initialLockedValues` when known, else of the current
 * `lockedValues`.
 */
function leverageMarginOf(quote: UnifiedQuote): bigint {
  const margin = quote.initialLockedValues ?? quote.lockedValues;
  return margin.cva + margin.lf + margin.partyAmm + margin.partyBmm;
}

/**
 * Compute the pure, price-independent {@link QuoteGroupMetrics} for a set of
 * child quotes.
 *
 * - `openQuantity` / `quantity` are plain sums (wei).
 * - `initialNotional = Σ(quantity × (initialOpenedPrice ?? requestedOpenPrice))`,
 *   rescaled to wei — the frozen at-open notional; partial closes do not shrink it.
 * - `weightedOpenPrice = Σ(openQuantity × openPrice) / Σ openQuantity`, suppressed
 *   (`undefined`) when there is no open size or any child has an unsettled open price.
 * - `lockedValues` sums each margin leg.
 * - `leverage = Σ(quantity × (requestedOpenPrice ?? openedPrice)) / Σ(cva + lf +
 *   partyAmm + partyBmm)`, each child using its frozen `initialLockedValues` (else
 *   `lockedValues`), as an 18-decimal fixed-point `bigint`; `undefined` when that
 *   margin is `0`.
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
  /** Σ(openQuantity × openPrice), scaled by `WEI²`; feeds `weightedOpenPrice` only. */
  let notionalNumerator = 0n;
  /** Σ(quantity × (initialOpenedPrice ?? requestedOpenPrice)), scaled by `WEI²` until the final rescale. */
  let initialNotionalNumerator = 0n;
  /** Σ(quantity × (requestedOpenPrice ?? openedPrice)), scaled by `WEI²` until the final divide. */
  let leverageNumerator = 0n;
  /** Σ of each child's frozen (initial-preferred) locked-margin legs, wei. */
  let leverageMargin = 0n;
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
    initialNotionalNumerator += quote.quantity * initialNotionalPriceOf(quote);
    leverageNumerator += quote.quantity * leveragePriceOf(quote);
    leverageMargin += leverageMarginOf(quote);
    cva += quote.lockedValues.cva;
    lf += quote.lockedValues.lf;
    partyAmm += quote.lockedValues.partyAmm;
    partyBmm += quote.lockedValues.partyBmm;
    if (hasUnsettledOpenPrice(quote)) anyUnsettledOpenPrice = true;
    if (isPendingOrder(quote)) pendingCount += 1;
    else if (isActivePosition(quote)) openCount += 1;
  }

  const lockedValues: LockedValues = { cva, lf, partyAmm, partyBmm };
  const initialNotional = initialNotionalNumerator / WEI;

  const weightedOpenPrice = openQuantity > 0n && !anyUnsettledOpenPrice ? notionalNumerator / openQuantity : undefined;
  // `leverageNumerator` is scaled by WEI²; dividing by the WEI-scaled margin yields an 18-decimal ratio.
  const leverage = leverageMargin > 0n ? leverageNumerator / leverageMargin : undefined;

  return {
    quoteCount: quotes.length,
    openCount,
    pendingCount,
    quantity,
    openQuantity,
    weightedOpenPrice,
    initialNotional,
    lockedValues,
    leverage,
  };
}
