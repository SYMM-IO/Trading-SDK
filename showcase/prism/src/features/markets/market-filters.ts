import type { MarketFamily } from "@/config/deployments";
import type { PrismMarket } from "./types";
import type { MarketStat } from "./use-market-stats";

/**
 * A merged market with its sortable figures already resolved.
 *
 * Sorting reads volume and 24h change straight off the row rather than through
 * a lookup, so a 700-row book sorts without re-hitting a map per comparison.
 */
export interface MarketRowModel {
  entry: PrismMarket;
  /** Rolling 24h traded value in dollars, once market info has loaded. */
  volume24h?: number;
  /** 24h price change in percent. Absent on solvers that publish none. */
  change24h?: number;
}

/** The family filter above the table. `all` keeps the merged book intact. */
export type MarketFilter = "all" | MarketFamily;

/**
 * Sortable columns.
 *
 * Mark price is deliberately absent: it ticks live, and a table that reorders
 * itself under the cursor is unusable. Open interest is absent too — for
 * solvers without a list endpoint it is only fetched for the visible window, so
 * sorting on it would sort a partially-loaded column.
 */
export type MarketSortKey = "name" | "change" | "volume" | "leverage";

export interface MarketSort {
  key: MarketSortKey;
  direction: "asc" | "desc";
}

/** The book's default order: deepest 24h volume first. */
export const DEFAULT_MARKET_SORT: MarketSort = { key: "volume", direction: "desc" };

/**
 * The direction a column starts in when it is first clicked.
 *
 * Names read best A→Z; every figure reads best biggest-first, because that is
 * the question a trader is actually asking of it.
 */
function defaultDirectionFor(key: MarketSortKey): MarketSort["direction"] {
  return key === "name" ? "asc" : "desc";
}

/**
 * The sort that a click on `key` should produce.
 *
 * Clicking the active column flips it; clicking any other column jumps to that
 * column's natural direction.
 *
 * @param current The active sort.
 * @param key The clicked column.
 */
export function nextSort(current: MarketSort, key: MarketSortKey): MarketSort {
  if (current.key !== key) return { key, direction: defaultDirectionFor(key) };
  return { key, direction: current.direction === "asc" ? "desc" : "asc" };
}

/**
 * Whether a market answers a free-text query.
 *
 * Plain substring matching over the display name and the ticker — no fuzzy
 * index, because the book is small enough to scan and a fuzzy match on tickers
 * puts `SOL` above `SOLV` for the query `sol`, which is worse than useless.
 *
 * @param entry A merged market row.
 * @param query A lowercased, trimmed query. An empty query matches everything.
 */
export function matchesQuery(entry: PrismMarket, query: string): boolean {
  if (!query) return true;
  return (
    entry.market.name.toLowerCase().includes(query) ||
    entry.market.symbol.toLowerCase().includes(query) ||
    entry.market.asset.toLowerCase().includes(query)
  );
}

/**
 * Narrow the merged book to one family and one query.
 *
 * The family filter composes with — and never replaces — the global palette
 * mode: the mode decides which solvers are read at all, this decides which of
 * the rows already fetched are shown.
 *
 * @param rows The merged book with its figures resolved.
 * @param filter The active family chip.
 * @param query Raw search text; trimmed and lowercased here.
 */
export function filterRows(rows: readonly MarketRowModel[], filter: MarketFilter, query: string): MarketRowModel[] {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => (filter === "all" || row.entry.family === filter) && matchesQuery(row.entry, needle));
}

/**
 * Order the visible rows.
 *
 * Rows with no figure always sink to the bottom regardless of direction — a
 * market whose solver publishes no 24h change has not "changed by zero", and
 * floating those rows to the top of an ascending sort would say it had.
 *
 * @param rows Rows to order. Not mutated.
 * @param sort The active column and direction.
 */
export function sortRows(rows: readonly MarketRowModel[], sort: MarketSort): MarketRowModel[] {
  const sign = sort.direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    if (sort.key === "name") {
      return sign * a.entry.market.name.localeCompare(b.entry.market.name);
    }

    const left = valueFor(a, sort.key);
    const right = valueFor(b, sort.key);

    if (left === undefined && right === undefined) {
      return a.entry.market.name.localeCompare(b.entry.market.name);
    }
    if (left === undefined) return 1;
    if (right === undefined) return -1;
    if (left === right) return a.entry.market.name.localeCompare(b.entry.market.name);

    return sign * (left - right);
  });
}

function valueFor(row: MarketRowModel, key: Exclude<MarketSortKey, "name">): number | undefined {
  if (key === "volume") return row.volume24h;
  if (key === "change") return row.change24h;
  return row.entry.market.maxLeverage;
}

/**
 * Attach the 24h figures to every merged market.
 *
 * @param markets The merged book.
 * @param statOf The lookup returned by `useMarketStats`.
 */
export function toRowModels(
  markets: readonly PrismMarket[],
  statOf: (family: MarketFamily, name: string, symbol?: string) => MarketStat | undefined,
  changeOf?: (market: PrismMarket) => number | undefined,
): MarketRowModel[] {
  return markets.map((entry) => {
    const stat = statOf(entry.family, entry.market.name, entry.market.symbol);
    /**
     * A listed market gets its 24h change from the solver's market-info; a
     * pool-priced one has none there and gets it from its pool instead. Both
     * are the same figure from different sources, so the column — and sorting
     * on it — stays meaningful across the merged book.
     */
    return { entry, volume24h: stat?.volume24h, change24h: stat?.change24h ?? changeOf?.(entry) };
  });
}
