import { WEI } from "../../shared/utils/wei";
import { PositionType } from "../../symmio-contracts/symmio/types";
import type { UnifiedQuote } from "../unified-quote";
import { isActivePosition } from "./partition-quotes";

/**
 * A quote's settled open price, or `undefined` while it has none — a pending or
 * optimistic open. Substituting `requestedOpenPrice` would value the position at
 * a fill that never happened.
 */
function settledOpenPriceOf(quote: UnifiedQuote): bigint | undefined {
  return quote.openedPrice !== undefined && quote.openedPrice !== 0n ? quote.openedPrice : undefined;
}

/**
 * Aggregated unrealized PnL for one group of quotes, valued at a single mark
 * price. Every amount is 18-decimal wei `bigint`.
 *
 * **Sign convention** — plain trader convention: a **positive** `upnl` means the
 * group is in profit. Note this is the *opposite* polarity to
 * {@link QuoteGroupFunding.net}, where positive means net-**paid**. The two
 * folds sit beside each other; do not assume a shared sign.
 *
 * **Completeness** — `upnl` is always the sum over the children that *could* be
 * valued, i.e. a lower bound in magnitude while some could not; it is never
 * suppressed to `0n`. Read {@link isComplete} to decide whether to trust it, and
 * treat `isComplete: false` as "PnL unknown", not as "no PnL".
 *
 * **One market, one mark price.** Every built-in `QuoteGroupingStrategy` keys on
 * `symbolId`, so a group is single-market by construction. A custom `keyOf` that
 * mixes markets makes this fold meaningless — that is the caller's to avoid.
 */
export interface QuoteGroupUpnl {
  /**
   * Σ signed unrealized PnL across the group's valued children (wei).
   * **Positive = the group is in profit.** A lower bound while
   * {@link isComplete} is `false`.
   */
  upnl: bigint;
  /**
   * Σ `openQuantity × openedPrice` across the valued children (wei) — the
   * at-entry basis a return percentage would divide by. `0n` when nothing was
   * valued.
   */
  openNotional: bigint;
  /** Number of children with open size that were valued against the mark price. */
  valuedCount: number;
  /**
   * Number of children with open size whose open price is not settled yet, so
   * their PnL is unknown. Resting orders and fully-closed children are not
   * counted here — they have no unrealized PnL to be missing.
   */
  unvaluedCount: number;
  /**
   * `true` only when a mark price was given, at least one child was valued, and
   * none was left unvalued — i.e. `upnl` is the group's complete unrealized PnL.
   *
   * A group with nothing to value (all-pending, all-closed, or empty) reports
   * `false` with `upnl: 0n`, so a consumer can tell "PnL unknown" apart from
   * "no PnL".
   */
  isComplete: boolean;
}

/**
 * Fold a group's child quotes into a single unrealized-PnL total at the current
 * mark price.
 *
 * Per child that is an active position with open size, using its **settled**
 * `openedPrice`:
 *
 * ```
 * delta  = markPrice − openedPrice
 * signed = positionType === SHORT ? −delta : delta
 * upnl  += openQuantity × signed / 1e18
 * ```
 *
 * Behaviour:
 *
 * - **Resting orders contribute nothing and are not counted as unvalued.** A
 *   pending order has no unrealized PnL by definition; counting it would pin
 *   `isComplete` to `false` for any group holding one. Same for terminal rows.
 * - **Fully-closed children** (`openQuantity ≤ 0`) are skipped and not counted —
 *   their PnL is realized, not unrealized.
 * - **A position with no settled `openedPrice`** (an optimistic or just-anchored
 *   open) lands in `unvaluedCount` and contributes nothing.
 * - **No mark price** (`undefined`) yields zero amounts with `isComplete: false`.
 *   `markPrice: 0n` is a *real* price (a total loss on a long) — that is why the
 *   parameter is `bigint | undefined` and never a string parsed in here. Use
 *   {@link decimalPriceToWei}, which returns `undefined` rather than a fabricated
 *   `0n`, to convert a price feed's decimal string.
 * - Exact `bigint`, order-independent, no IO. This deliberately differs from the
 *   per-quote `calculateQuoteUpnl`, which is decimal-string/float based. Each
 *   child's term is floored independently (max 1 wei of error per child), matching
 *   `estimateGroupTpSlReturn` and `calculateLiquidationPrice`.
 *
 * @param quotes - The group's child quotes (pass `group.quotes`).
 * @param markPrice - Current mark price in 18-decimal wei, or `undefined` before the first tick.
 * @returns The aggregated unrealized PnL for the group.
 *
 * @example
 * ```ts
 * const upnl = aggregateGroupUpnl(group.quotes, decimalPriceToWei(markPrice));
 * if (!upnl.isComplete) showSkeleton();
 * else render(upnl.upnl); // positive = in profit
 * ```
 */
export function aggregateGroupUpnl(quotes: readonly UnifiedQuote[], markPrice?: bigint): QuoteGroupUpnl {
  let upnl = 0n;
  let openNotional = 0n;
  let valuedCount = 0;
  let unvaluedCount = 0;

  for (const quote of quotes) {
    /** Resting orders and terminal rows carry no unrealized PnL at all. */
    if (!isActivePosition(quote)) continue;
    /** Nothing open left: whatever this quote earned is realized, not unrealized. */
    if (quote.openQuantity <= 0n) continue;

    const openedPrice = settledOpenPriceOf(quote);
    if (openedPrice === undefined || markPrice === undefined) {
      unvaluedCount += 1;
      continue;
    }

    const delta = markPrice - openedPrice;
    const signed = quote.positionType === PositionType.SHORT ? -delta : delta;
    upnl += (quote.openQuantity * signed) / WEI;
    openNotional += (quote.openQuantity * openedPrice) / WEI;
    valuedCount += 1;
  }

  return {
    upnl,
    openNotional,
    valuedCount,
    unvaluedCount,
    isComplete: valuedCount > 0 && unvaluedCount === 0,
  };
}
