import type { UnifiedQuote } from "./unified-quote";

/**
 * Compute a quote's remaining **open** size — the live quantity still on the
 * position, `quantity − closedAmount`.
 *
 * A position keeps its original {@link UnifiedQuote.quantity} for its entire life;
 * a partial close does **not** shrink `quantity`, it accrues into
 * {@link UnifiedQuote.closedAmount}. The size a trader can still close (and the
 * figure a UI shows as "position size") is therefore the difference between the
 * two. When `closedAmount` is absent (an off-chain optimistic open that has not
 * closed anything yet) it is treated as `0`, so the open size equals `quantity`;
 * once fully closed `closedAmount === quantity`, so the open size is `0` — the
 * exact semantics of the on-chain `LibQuote.quoteOpenAmount`.
 *
 * This is a **size, not a state**. A quote that has not opened at all — `PENDING`,
 * `LOCKED`, `CANCEL_PENDING` — has closed nothing, so it still reports its full
 * `quantity` here. Do not use `> 0` as a test for "this is an open position":
 * classify with `isPendingOrder` / `isActivePosition`, which read the on-chain
 * `QuoteStatus`.
 *
 * @param quote - The amount fields needed to derive the open size.
 * @returns The remaining open quantity, in 18-decimal wei.
 *
 * @example
 * ```ts
 * // quantity 142.191812e18, closedAmount 100e18
 * quoteOpenQuantity(quote); // → 42.191812e18
 * ```
 */
export function quoteOpenQuantity(quote: Pick<UnifiedQuote, "quantity" | "closedAmount">): bigint {
  return quote.quantity - (quote.closedAmount ?? 0n);
}
