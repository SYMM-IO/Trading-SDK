import type { UnifiedQuote } from "./unified-quote";

/**
 * A quote's settled open price, or `undefined` while it has none — a pending or
 * optimistic open.
 *
 * A quote carries `openedPrice: 0n` in the same situations it carries
 * `undefined`, so both collapse to `undefined` here; callers never have to
 * repeat that pair of checks. Substituting `requestedOpenPrice` would value the
 * position at a fill that never happened — use {@link openPriceOf} only where
 * that fallback is intended.
 *
 * @param quote - Any object carrying the quote's settled open price.
 * @returns The settled price in wei, or `undefined` when it is not settled yet.
 */
export function settledOpenPriceOf(quote: Pick<UnifiedQuote, "openedPrice">): bigint | undefined {
  return quote.openedPrice !== undefined && quote.openedPrice !== 0n ? quote.openedPrice : undefined;
}

/**
 * Whether a quote still lacks a settled open price (a pending or optimistic
 * open). The exact complement of {@link settledOpenPriceOf}.
 *
 * @param quote - Any object carrying the quote's settled open price.
 * @returns `true` while the open price is unsettled.
 */
export function hasUnsettledOpenPrice(quote: Pick<UnifiedQuote, "openedPrice">): boolean {
  return settledOpenPriceOf(quote) === undefined;
}

/**
 * A quote's open price for valuation: the settled `openedPrice`, else the
 * `requestedOpenPrice` it was submitted at.
 *
 * This is the fallback rule shared by `aggregateGroupMetrics` and
 * `toGroupTpSlChildren`, so a group's weighted open price and its TP/SL
 * children are always valued against the same number.
 *
 * @param quote - Any object carrying the quote's open prices.
 * @returns The valuation price in wei.
 */
export function openPriceOf(quote: Pick<UnifiedQuote, "openedPrice" | "requestedOpenPrice">): bigint {
  return settledOpenPriceOf(quote) ?? quote.requestedOpenPrice;
}

/**
 * A quote's reference price for leverage: the `requestedOpenPrice`, else the
 * settled `openedPrice`.
 *
 * **The precedence is the inverse of {@link openPriceOf}** and that is
 * deliberate: leverage describes the position as it was *opened*, so the price
 * the trader committed to wins, and the settled fill steps in only when there is
 * no requested price on record. Shared by `aggregateGroupMetrics` and
 * `calculateQuoteLeverage`, which agree on this rule while deliberately
 * differing in numeric strategy (exact bigint vs. float).
 *
 * @param quote - Any object carrying the quote's open prices.
 * @returns The leverage reference price in wei, or `0n` when neither is set.
 */
export function leveragePriceOf(quote: Pick<UnifiedQuote, "openedPrice" | "requestedOpenPrice">): bigint {
  return quote.requestedOpenPrice !== 0n ? quote.requestedOpenPrice : (quote.openedPrice ?? 0n);
}
