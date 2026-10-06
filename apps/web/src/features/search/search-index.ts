import Fuse, { type FuseResultMatch } from "fuse.js";
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
 * Multiplicative relevance tilt per type. Cards lead — they are the actionable
 * core of every page — then the contract/flow pages that group them, then
 * navigation, with market/symbol data last unless a strong textual match pulls it
 * up. Tune by eye, not by formula — Fuse's score is an uncalibrated, non-linear
 * value. This mirrors the section order in `SEARCH_TYPE_META`.
 */
const TYPE_TILT: Record<SearchType, number> = {
  card: 0.3,
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
  /** The keyword that matched best — an SDK hook, say — for a row to show why it matched. */
  keywordMatch?: { value: string; ranges: MatchRanges };
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
      keywordMatch: bestKeywordMatch(matches, trimmed),
    };
  });

  ranked.sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));
  return ranked.slice(0, limit);
}

/**
 * The keyword that best explains a hit: the shortest one containing the query
 * outright, else the one with the longest unbroken fuzzy run — scattered
 * single-letter matches say little about why a hit matched.
 */
function bestKeywordMatch(matches: readonly FuseResultMatch[] | undefined, query: string): RankedEntry["keywordMatch"] {
  const phrase = query.toLowerCase();
  let best: RankedEntry["keywordMatch"];
  let bestContainsQuery = false;
  let bestRun = 0;

  for (const match of matches ?? []) {
    if (match.key !== "keywords" || !match.value) continue;

    const at = match.value.toLowerCase().indexOf(phrase);
    if (at !== -1) {
      if (!bestContainsQuery || (best && match.value.length < best.value.length)) {
        best = { value: match.value, ranges: [[at, at + phrase.length - 1]] };
        bestContainsQuery = true;
      }
      continue;
    }
    if (bestContainsQuery) continue;

    const run = Math.max(0, ...match.indices.map(([start, end]) => end - start + 1));
    if (run > bestRun) {
      bestRun = run;
      best = { value: match.value, ranges: match.indices };
    }
  }
  return best;
}
