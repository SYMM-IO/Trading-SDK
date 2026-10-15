/** The kind of thing a {@link SearchEntry} points at, used for grouping and ranking. */
export type SearchType = "card" | "contract" | "flow" | "route" | "market" | "symbol";

/** Where a card lives in the app — shown beside it in results, so a hit says where it leads. */
export interface SearchLocation {
  /** The page, named as the navigation names it. */
  page: string;
  /** The section within the page, when the page has sections. */
  section?: string;
}

/** One searchable destination in the app-wide command palette. */
export interface SearchEntry {
  /** Stable, globally-unique id (`"<type>:<natural-id>"`); used for recency and keys. */
  id: string;
  type: SearchType;
  /** Primary label and highest-weight match field. */
  title: string;
  /** Secondary line shown under the title — what a card does, or a page's description. */
  subtitle?: string;
  /** Read/write for card entries — drives the row chip to match the card's own. */
  kind?: "read" | "write";
  /** Extra match terms — SDK hooks and actions, ABI names, sections, ids, aliases. */
  keywords: string[];
  /** Navigation target. A card's — or a console flow's — carries its `#anchor`: the card's DOM id. */
  href: string;
  /** Where the destination lives — set on cards, console flows and Contracts sub-pages. */
  location?: SearchLocation;
  /** How many searchable cards live under this page. Set on route entries. */
  cardCount?: number;
  /** How many searchable console flows live on this page. Set on route entries. */
  flowCount?: number;
}

/** Display metadata per {@link SearchType}: the section heading and its order. */
export const SEARCH_TYPE_META: Record<SearchType, { heading: string; order: number }> = {
  card: { heading: "Cards", order: 0 },
  contract: { heading: "Contracts", order: 1 },
  flow: { heading: "Flows", order: 2 },
  route: { heading: "Go to", order: 3 },
  market: { heading: "Markets", order: 4 },
  symbol: { heading: "Price symbols", order: 5 },
};

/**
 * Split an entry's `href` into its pathname and the card anchor after `#`, if
 * any. The query, as in `/integration?flow=deposit#…`, belongs to neither.
 */
export function splitHref(href: string): { pathname: string; anchor?: string } {
  const url = new URL(href, "https://search.invalid");
  return { pathname: url.pathname, anchor: url.hash ? decodeURIComponent(url.hash.slice(1)) : undefined };
}
