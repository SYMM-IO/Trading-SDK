import Fuse from "fuse.js";
import type { SearchEntry, SearchType } from "./search-entry";

/**
 * Per-field weights. `title` dominates so a name/symbol/method-id hit outranks a
 * match buried in a description; `keywords` carry ABI/flow/alias terms.
 */
const KEYS: ReadonlyArray<{ name: keyof SearchEntry; weight: number }> = [
  { name: "title", weight: 0.7 },
  { name: "keywords", weight: 0.2 },
  { name: "subtitle", weight: 0.1 },
];

/**
 * Build a Fuse index over `entries`. `ignoreLocation` and a tightened threshold
 * are deliberate — the defaults skew lenient and add a position bias that hurts
 * short-token, app-wide search.
 */
export function createSearchIndex(entries: readonly SearchEntry[]): Fuse<SearchEntry> {
  return new Fuse([...entries], {
    includeScore: true,
    includeMatches: true,
    ignoreLocation: true,
    threshold: 0.35,
    minMatchCharLength: 1,
    keys: KEYS as { name: string; weight: number }[],
  });
}

/**
 * Multiplicative relevance tilt per type. Methods lead — they are the actionable
 * core of the inspector — then the contract/flow pages that group them, then
 * navigation, with market/symbol data last unless a strong textual match pulls it
 * up. Tune by eye, not by formula — Fuse's score is an uncalibrated, non-linear
 * value. This mirrors the section order in `SEARCH_TYPE_META`.
 */
const TYPE_TILT: Record<SearchType, number> = {
  method: 0.3,
  contract: 0.15,
  flow: 0.12,
  route: 0.1,
  market: 0,
  symbol: 0,
};

/** Additive nudge applied to entries the user has opened recently. */
const RECENCY_BOOST = 0.1;

/** Inclusive `[start, end]` character ranges of a field that matched the query. */
export type MatchRanges = ReadonlyArray<readonly [number, number]>;

/** A search hit with its final, post-processed score and per-field match ranges. */
export interface RankedEntry {
  entry: SearchEntry;
  score: number;
  titleMatches?: MatchRanges;
  subtitleMatches?: MatchRanges;
}

/**
 * Rank `query` against the index, then fold in type tilt and a recency boost.
 * Returns a flat list ordered best-first with the title/subtitle match ranges for
 * highlighting; an empty/whitespace query yields no results (the palette shows
 * recents/quick links instead).
 */
export function rankEntries(
  index: Fuse<SearchEntry>,
  query: string,
  options: { recentIds?: readonly string[]; limit?: number } = {},
): RankedEntry[] {
  const { recentIds = [], limit = 24 } = options;
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const recent = new Set(recentIds);
  const ranked = index.search(trimmed).map(({ item, score, matches }) => {
    const relevance = 1 - (score ?? 0);
    const final = relevance * (1 + TYPE_TILT[item.type]) + (recent.has(item.id) ? RECENCY_BOOST : 0);
    return {
      entry: item,
      score: final,
      titleMatches: matches?.find((match) => match.key === "title")?.indices,
      subtitleMatches: matches?.find((match) => match.key === "subtitle")?.indices,
    };
  });

  ranked.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));
  return ranked.slice(0, limit);
}
