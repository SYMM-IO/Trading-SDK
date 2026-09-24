import type { UnifiedQuote } from "../unified-quote";

/**
 * Integer division rounding **up** (toward positive infinity). JavaScript has
 * no built-in ceiling for `bigint` — `/` always truncates, and `Math.ceil`
 * neither accepts `bigint` nor survives the 2^53 precision limit of `number`.
 */
function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

/**
 * Smallest open quantity a quote may keep after a partial close, wei.
 *
 * The contract accepts a partial close only when the remaining position's
 * partyA-locked value stays above the symbol's minimum (perps-core v0.8.6
 * `LibQuoteClose.closeQuote`: `lockedValues.totalForPartyA() == 0 ||
 * lockedValues.totalForPartyA() >= minAcceptableQuoteValue` — "Remaining quote
 * value is low"). Locked values shrink proportionally with the closed amount,
 * so the size bound is:
 *
 * `remaining ≥ openQuantity × minAcceptableQuoteValue / lockedForPartyA`
 *
 * rounded **up** (a remainder one wei short would revert). `lockedForPartyA` is
 * the current `cva + lf + partyAmm`.
 *
 * Returns `openQuantity` (i.e. "full close only") when the quote has no
 * partyA-locked value on record — without a margin basis no partial remainder
 * can be proven acceptable.
 *
 * @param quote - The quote being partially closed.
 * @param minAcceptableQuoteValue - The symbol's `minAcceptableQuoteValue`, wei.
 * @returns The minimum acceptable remainder, wei.
 */
export function minRemainingQuantityOf(quote: UnifiedQuote, minAcceptableQuoteValue: bigint): bigint {
  const lockedForPartyA = quote.lockedValues.cva + quote.lockedValues.lf + quote.lockedValues.partyAmm;
  if (lockedForPartyA <= 0n) return quote.openQuantity;
  // Round up — rounding down would allow a remainder that reverts on-chain.
  return ceilDiv(quote.openQuantity * minAcceptableQuoteValue, lockedForPartyA);
}
