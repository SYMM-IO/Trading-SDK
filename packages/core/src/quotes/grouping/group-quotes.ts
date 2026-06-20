import type { Address } from "viem";
import type { UnifiedQuote } from "../unified-quote";
import { aggregateGroupMetrics } from "./aggregate-metrics";
import { resolveQuoteGroupingStrategy } from "./group-strategy";
import type { QuoteGroup, QuoteGroupBy, QuoteGroupingStrategy } from "./quote-group";

/** Best-known ordering timestamp for a quote — last status change, else creation. */
function orderingTimestamp(quote: UnifiedQuote): bigint {
  return quote.statusModifyTimestamp ?? quote.createTimestamp ?? 0n;
}

/** Newest-first by ordering timestamp, breaking ties by `key` for a stable sort. */
function byNewestQuote(a: UnifiedQuote, b: UnifiedQuote): number {
  const ta = orderingTimestamp(a);
  const tb = orderingTimestamp(b);
  if (ta !== tb) return tb > ta ? 1 : -1;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

/** Default group order: newest group first (by its newest child), ties broken by `key`. */
function byNewestGroup(a: QuoteGroup, b: QuoteGroup): number {
  const ta = a.quotes[0] ? orderingTimestamp(a.quotes[0]) : 0n;
  const tb = b.quotes[0] ? orderingTimestamp(b.quotes[0]) : 0n;
  if (ta !== tb) return tb > ta ? 1 : -1;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

/** The VA a group resolves to: from its first on-chain child, else any child that carries one. */
function resolveGroupVaAddress(quotes: readonly UnifiedQuote[]): Address | undefined {
  return (
    quotes.find((quote) => quote.origin === "onchain" && quote.vaAddress)?.vaAddress ??
    quotes.find((quote) => quote.vaAddress)?.vaAddress
  );
}

/** Options for {@link groupQuotes}. */
export interface GroupQuotesOptions {
  /**
   * Comparator for the returned groups. Defaults to newest-group-first (by each
   * group's newest child). Child quotes within a group are always sorted
   * newest-first regardless.
   */
  sort?: (a: QuoteGroup, b: QuoteGroup) => number;
}

/**
 * Fold quotes into {@link QuoteGroup}s under a {@link QuoteGroupingStrategy}.
 *
 * Pure and deterministic: it groups exactly the array it is given (partition into
 * positions vs pending orders first with `partitionQuotes` if you only want to
 * group open positions). Each group carries its child quotes (newest first), its
 * resolved Virtual Account, an `isAggregate` flag, and pure
 * {@link QuoteGroupMetrics}. Groups are returned newest-first by default.
 *
 * @param quotes - The quotes to group.
 * @param strategy - A {@link SubAccountIsolationType} or a custom `{ keyOf }`.
 * @param options - Optional group ordering override.
 * @returns The groups.
 *
 * @example
 * ```ts
 * const { positions } = partitionQuotes(quotes);
 * const groups = groupQuotes(positions, SubAccountIsolationType.MARKET_DIRECTION);
 * // groups[0].metrics.openQuantity, groups[0].metrics.weightedOpenPrice, …
 * ```
 */
export function groupQuotes(
  quotes: readonly UnifiedQuote[],
  strategy: QuoteGroupingStrategy,
  options?: GroupQuotesOptions,
): QuoteGroup[] {
  const keyOf = resolveQuoteGroupingStrategy(strategy);

  /** Insertion-ordered buckets so groups are built deterministically before sorting. */
  const buckets = new Map<string, { by: QuoteGroupBy; quotes: UnifiedQuote[] }>();
  for (const quote of quotes) {
    const { key, by } = keyOf(quote);
    const bucket = buckets.get(key);
    if (bucket) bucket.quotes.push(quote);
    else buckets.set(key, { by, quotes: [quote] });
  }

  const groups: QuoteGroup[] = [];
  for (const [key, bucket] of buckets) {
    const children = bucket.quotes.sort(byNewestQuote);
    groups.push({
      key,
      by: bucket.by,
      vaAddress: resolveGroupVaAddress(children),
      quotes: children,
      isAggregate: children.length > 1,
      metrics: aggregateGroupMetrics(children),
    });
  }

  return groups.sort(options?.sort ?? byNewestGroup);
}
