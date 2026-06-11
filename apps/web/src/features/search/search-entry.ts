/** The kind of thing a {@link SearchEntry} points at, used for grouping and ranking. */
export type SearchType = "route" | "contract" | "flow" | "method" | "market" | "symbol";

/** One searchable destination in the app-wide command palette. */
export interface SearchEntry {
  /** Stable, globally-unique id (`"<type>:<natural-id>"`); used for recency and keys. */
  id: string;
  type: SearchType;
  /** Primary label and highest-weight match field. */
  title: string;
  /** Secondary context line shown under the title. */
  subtitle?: string;
  /** Read/write for method entries — drives the row badge to match the method cards. */
  kind?: "read" | "write";
  /** Extra match terms — ABI name, flow groups, ids, addresses, aliases. */
  keywords: string[];
  /** Navigation target (may include a `#anchor`). */
  href: string;
}

/** Display metadata per {@link SearchType}: the section heading and its order. */
export const SEARCH_TYPE_META: Record<SearchType, { heading: string; order: number }> = {
  method: { heading: "Methods", order: 0 },
  contract: { heading: "Contracts", order: 1 },
  flow: { heading: "Flows", order: 2 },
  route: { heading: "Go to", order: 3 },
  market: { heading: "Markets", order: 4 },
  symbol: { heading: "Price symbols", order: 5 },
};
