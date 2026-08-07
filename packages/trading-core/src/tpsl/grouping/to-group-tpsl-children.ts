import type { UnifiedQuote } from "../../quotes/unified-quote";
import type { QuoteTpSl } from "../types";
import type { GroupTpSlChild } from "./types";

/**
 * Resolve a quote's confirmed TP/SL snapshot. Receives the whole quote so the
 * caller can look up by `key`, by `quoteId`, by `tempQuoteId`, or through a
 * store index that aliases all of them.
 */
export type GroupTpSlSnapshotLookup = (quote: UnifiedQuote) => QuoteTpSl | undefined;

/**
 * Build {@link GroupTpSlChild}s from a grouped position's child quotes.
 *
 * Every quote produces a child — including off-chain ones, which come back with
 * `quoteId: undefined` so the summary still counts them (an unprotected leg
 * genuinely drags coverage down) while the planner skips them as
 * `"not-anchored"`. `openPrice` uses the same fallback `aggregateGroupMetrics`
 * uses (`openedPrice` when settled and non-zero, else `requestedOpenPrice`);
 * `virtualAccount` is `vaAddress ?? partyA`, which for a Virtual-Account-scoped
 * position is the VA itself.
 *
 * @param quotes - The grouped position's child quotes (`QuoteGroup.quotes`).
 * @param snapshot - Resolves each quote's confirmed TP/SL snapshot; a missing
 *   snapshot becomes a blank one (both sides empty, both states `"canceled"`).
 * @returns Children in input order.
 *
 * @example
 * ```ts
 * const children = toGroupTpSlChildren(group.quotes, (quote) => tpslByKey.get(quote.key));
 * const summary = summarizeQuoteGroupTpSl(children);
 * ```
 */
export function toGroupTpSlChildren(
  quotes: readonly UnifiedQuote[],
  snapshot: GroupTpSlSnapshotLookup,
): GroupTpSlChild[] {
  return quotes.map((quote) => ({
    key: quote.key,
    quoteId: quote.quoteId,
    virtualAccount: quote.vaAddress ?? quote.partyA,
    symbolId: quote.symbolId,
    positionType: quote.positionType,
    openQuantity: quote.openQuantity,
    openPrice: openPriceOf(quote),
    tpsl: snapshot(quote) ?? blankQuoteTpSl(),
  }));
}

/** A quote's open price for valuation: the settled `openedPrice`, else the requested one. */
function openPriceOf(quote: UnifiedQuote): bigint {
  return quote.openedPrice !== undefined && quote.openedPrice !== 0n ? quote.openedPrice : quote.requestedOpenPrice;
}

/** A snapshot with no orders on either side. */
function blankQuoteTpSl(): QuoteTpSl {
  return {
    tp: "",
    sl: "",
    tpOpenPrice: "",
    slOpenPrice: "",
    tpPriceType: "markPrice",
    slPriceType: "markPrice",
    tpState: "canceled",
    slState: "canceled",
  };
}
