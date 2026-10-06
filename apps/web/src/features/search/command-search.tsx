"use client";

import { Badge } from "@symmio/ui/components/badge";
import { CommandPalette, type CommandPaletteGroup } from "@symmio/ui/components/command-palette";
import { cn } from "@symmio/ui/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { arriveAtCard } from "./arrive-at-card";
import { SEARCH_TYPE_META, splitHref, type SearchEntry, type SearchLocation, type SearchType } from "./search-entry";
import { createSearchIndex, rankEntries, type MatchRanges, type RankedEntry } from "./search-index";
import { useRecentSearches } from "./use-recent-searches";
import { useSearchEntries } from "./use-search-entries";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Singular type label shown as a row chip on entries that are not cards. */
const TYPE_CHIP: Record<Exclude<SearchType, "card">, string> = {
  route: "Page",
  contract: "Contract",
  flow: "Flow",
  market: "Market",
  symbol: "Symbol",
};

/** Titles rendered in mono — identifiers rather than prose. Card titles are mono on the cards themselves. */
const MONO_TYPES: ReadonlySet<SearchType> = new Set<SearchType>(["card", "market", "symbol"]);

/**
 * Separates a row's group from its entry id in the palette's item ids. The same
 * entry may sit in two resting groups (a recent card that is also on this page),
 * and every palette row needs its own id.
 */
const ITEM_ID_SEPARATOR = "@";

/**
 * The app-wide command palette: a Fuse-ranked, weighted search over every card,
 * console flow, page, and live market/symbol. An empty query shows recent picks,
 * the cards on the current page, and quick navigation; typing ranks every source
 * together and groups the hits by kind. Choosing a card lands on it — a smooth
 * scroll when it is on this page, a direct landing on another — and marks its
 * arrival; anything else navigates.
 */
export function CommandSearch({ open, onOpenChange }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [activeItemId, setActiveItemId] = useState<string | undefined>();
  const cancelArrival = useRef<(() => void) | undefined>(undefined);
  const { entries, isLoadingDynamic } = useSearchEntries(open);
  const { recentIds, push } = useRecentSearches();

  const index = useMemo(() => createSearchIndex(entries), [entries]);
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const byAnchor = useMemo(() => groupByAnchor(entries), [entries]);
  const ranked = useMemo(() => rankEntries(index, query, { recentIds }), [index, query, recentIds]);

  /**
   * The cards rendered on this page, in page order, read from the DOM as the
   * palette opens — in the opening render itself, so the first row Enter acts on
   * is already one of them. A card shown on several pages (a Contracts method on
   * its flow pages) or gated out of this one is then listed exactly when it is here.
   */
  const pageCards = useMemo(() => (open ? renderedCards() : []), [open]);

  /** Clear the field after the close animation settles, so it reopens empty. */
  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => setQuery(""), 150);
      return () => clearTimeout(id);
    }
  }, [open]);

  /** A pending arrival must not outlive the palette. */
  useEffect(() => () => cancelArrival.current?.(), []);

  const groups = useMemo<CommandPaletteGroup[]>(() => {
    if (query.trim().length > 0) return resultGroups(ranked, query.trim());
    return restingGroups({
      recent: recentIds.map((id) => byId.get(id)).filter((entry): entry is SearchEntry => Boolean(entry)),
      onThisPage: pageCards.flatMap(({ id, offers }) =>
        (byAnchor.get(id) ?? []).filter((entry) => !offers || offers.includes(entry.id)),
      ),
      routes: entries.filter((entry) => entry.type === "route"),
    });
  }, [query, ranked, recentIds, byId, pageCards, byAnchor, entries]);

  const activeEntry = activeItemId ? byId.get(entryIdOf(activeItemId)) : undefined;

  function handleSelect(itemId: string) {
    const entry = byId.get(entryIdOf(itemId));
    if (!entry) return;
    push(entry.id);
    onOpenChange(false);
    cancelArrival.current?.();

    const { pathname: target, anchor } = splitHref(entry.href);
    if (!anchor) {
      router.push(entry.href);
      return;
    }

    /**
     * A card on this page — its home page, or one it is also shown on — is reached
     * here: a glide, so the jump reads as movement through the page, with Next's
     * own instant hash scroll switched off. A card elsewhere is landed on directly.
     */
    const here = target === pathname || pageCards.some((card) => card.id === anchor);
    const href = target === pathname || !here ? entry.href : `${pathname}#${anchor}`;
    router.push(href, { scroll: !here });
    cancelArrival.current = arriveAtCard(anchor, {
      motion: here ? "smooth" : "instant",
      pathname: here ? pathname : target,
    });
  }

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      query={query}
      onQueryChange={setQuery}
      groups={groups}
      onSelect={handleSelect}
      onActiveChange={setActiveItemId}
      label="Search Symmio Trading-SDK"
      placeholder="Search cards, pages, markets…"
      emptyState={
        isLoadingDynamic
          ? "Loading…"
          : "No matches. Try a card title, an SDK hook like usePoolTransactions, or a market."
      }
      footer={<Footer active={activeEntry} loading={isLoadingDynamic} />}
    />
  );
}

/** The palette item id for `entry` shown in `groupId`. */
function itemIdOf(groupId: string, entry: SearchEntry): string {
  return `${groupId}${ITEM_ID_SEPARATOR}${entry.id}`;
}

/** The entry id behind a palette item id. */
function entryIdOf(itemId: string): string {
  return itemId.slice(itemId.indexOf(ITEM_ID_SEPARATOR) + 1);
}

/** A design-system card on the page, and — for a card that leads to several entries — which it offers now. */
interface RenderedCard {
  id: string;
  /** From the card's `data-search-entries`: the entry ids it currently offers. Unset means all of them. */
  offers?: string[];
}

/** The design-system cards on the page, in page order. */
function renderedCards(): RenderedCard[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-slot="card"][id]'), (card) => ({
    id: card.id,
    offers: card.dataset.searchEntries?.split(" "),
  }));
}

/** Index in-page destinations by the anchor they land on. Several flows share the console's. */
function groupByAnchor(entries: readonly SearchEntry[]): Map<string, SearchEntry[]> {
  const byAnchor = new Map<string, SearchEntry[]>();
  for (const entry of entries) {
    const { anchor } = splitHref(entry.href);
    if (!anchor) continue;
    byAnchor.set(anchor, [...(byAnchor.get(anchor) ?? []), entry]);
  }
  return byAnchor;
}

/**
 * Build the empty-query view: recently opened entries, the cards on the current
 * page (so the palette doubles as an in-page jump list), then quick navigation.
 */
function restingGroups({
  recent,
  onThisPage,
  routes,
}: {
  recent: readonly SearchEntry[];
  onThisPage: readonly SearchEntry[];
  routes: readonly SearchEntry[];
}): CommandPaletteGroup[] {
  const groups: CommandPaletteGroup[] = [];
  if (recent.length > 0) {
    groups.push({ id: "recent", heading: "Recent", items: recent.map((entry) => toItem("recent", entry)) });
  }
  if (onThisPage.length > 0) {
    groups.push({
      id: "here",
      heading: "On this page",
      items: onThisPage.map((entry) => toItem("here", entry, { onCurrentPage: true })),
    });
  }
  groups.push({ id: "go-to", heading: "Go to", items: routes.map((entry) => toItem("go-to", entry)) });
  return groups;
}

/**
 * Group ranked hits by type, items kept in score order. The group holding the
 * best hit comes first — an exact match is never buried under a list of weaker
 * cards — with the fixed type order breaking ties.
 */
function resultGroups(ranked: readonly RankedEntry[], query: string): CommandPaletteGroup[] {
  const buckets = new Map<SearchType, RankedEntry[]>();
  for (const hit of ranked) {
    const bucket = buckets.get(hit.entry.type) ?? [];
    bucket.push(hit);
    buckets.set(hit.entry.type, bucket);
  }

  return [...buckets.entries()]
    .sort(
      ([typeA, hitsA], [typeB, hitsB]) =>
        (hitsB[0]?.score ?? 0) - (hitsA[0]?.score ?? 0) ||
        SEARCH_TYPE_META[typeA].order - SEARCH_TYPE_META[typeB].order,
    )
    .map(([type, hits]) => ({
      id: type,
      heading: SEARCH_TYPE_META[type].heading,
      items: hits.map((hit) => toItem(type, hit.entry, { ranked: hit, query })),
    }));
}

/** Render one entry as a palette row. */
function toItem(
  groupId: string,
  entry: SearchEntry,
  options: { ranked?: RankedEntry; query?: string; onCurrentPage?: boolean } = {},
) {
  return {
    id: itemIdOf(groupId, entry),
    label: (
      <ResultRow
        entry={entry}
        ranked={options.ranked}
        query={options.query ?? ""}
        onCurrentPage={options.onCurrentPage ?? false}
      />
    ),
  };
}

/**
 * One result, laid out like the card it leads to: the card's read/write chip, its
 * mono title, and what it does underneath — with where it lives set to the right,
 * page level with the title and section level with the summary. When the query
 * matched neither, only an SDK name the card exercises, that name replaces the
 * summary, so the row shows why it matched. In a narrow palette the location
 * takes the summary's line instead.
 */
function ResultRow({
  entry,
  ranked,
  query,
  onCurrentPage,
}: {
  entry: SearchEntry;
  ranked?: RankedEntry;
  query: string;
  onCurrentPage: boolean;
}) {
  const location = entry.location;
  const locationLine = location ? locationText(location, onCurrentPage) : undefined;
  const titleRanges = readableRanges(entry.title, query, ranked?.titleMatches);
  const subtitleRanges = entry.subtitle ? readableRanges(entry.subtitle, query, ranked?.subtitleMatches) : [];
  const keywordHit =
    ranked?.keywordMatch && titleRanges.length === 0 && subtitleRanges.length === 0 ? ranked.keywordMatch : undefined;

  return (
    <div data-search-href={entry.href} className="@container flex w-full min-w-0 items-start gap-3">
      <RowChip entry={entry} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "truncate text-sm",
            MONO_TYPES.has(entry.type) ? "text-foreground font-mono" : "text-foreground font-medium",
          )}
        >
          {highlight(entry.title, titleRanges)}
        </span>
        {keywordHit ? (
          <span className="text-muted-foreground truncate font-mono text-xs">
            {highlight(keywordHit.value, readableRanges(keywordHit.value, query, keywordHit.ranges))}
          </span>
        ) : entry.subtitle ? (
          <span className={cn("text-muted-foreground truncate text-xs", locationLine && "hidden @md:block")}>
            {highlight(entry.subtitle, subtitleRanges)}
          </span>
        ) : null}
        {locationLine && !keywordHit ? (
          <span className="text-muted-foreground truncate text-xs @md:hidden">{locationLine}</span>
        ) : null}
      </div>
      {location ? <LocationColumn location={location} onCurrentPage={onCurrentPage} /> : null}
      <DestinationCount entry={entry} />
    </div>
  );
}

/** How many cards — or, for a console page, flows — a page row leads into. */
function DestinationCount({ entry }: { entry: SearchEntry }) {
  const [count, noun] = entry.cardCount ? [entry.cardCount, "card"] : [entry.flowCount ?? 0, "flow"];
  if (count === 0) return null;
  return (
    <span className="text-muted-foreground mt-0.5 shrink-0 text-xs tabular-nums">
      {count} {count === 1 ? noun : `${noun}s`}
    </span>
  );
}

/** Where a card lives, set right: the page beside the title and the section beside the summary. */
function LocationColumn({ location, onCurrentPage }: { location: SearchLocation; onCurrentPage: boolean }) {
  const lines = (onCurrentPage ? [location.section] : [location.page, location.section]).filter(
    (line): line is string => Boolean(line),
  );
  return (
    <div className="hidden max-w-[40%] shrink-0 flex-col items-end text-right @md:flex">
      {lines.map((line, index) => (
        <span
          key={index}
          className={cn("max-w-full truncate text-xs", index === 0 ? "text-foreground/75" : "text-muted-foreground")}
        >
          {line}
        </span>
      ))}
    </div>
  );
}

/** A location on one line, for the narrow layout — just the section when the card is on this page. */
function locationText(location: SearchLocation, onCurrentPage: boolean): string | undefined {
  if (onCurrentPage) return location.section;
  return location.section ? `${location.page} › ${location.section}` : location.page;
}

/** The leading chip: the card's read/write badge (matching the card's own), else a type tag. */
function RowChip({ entry }: { entry: SearchEntry }) {
  if (entry.type === "card" && entry.kind) {
    return (
      <Badge
        variant={entry.kind === "write" ? "warning" : "info"}
        className="mt-0.5 min-w-14 shrink-0 self-start tracking-wide uppercase"
      >
        {entry.kind}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-muted-foreground mt-0.5 min-w-14 shrink-0 self-start tracking-wide uppercase"
    >
      {entry.type === "card" ? "Card" : TYPE_CHIP[entry.type]}
    </Badge>
  );
}

/**
 * The spans of `text` worth marking for `query`: the query wherever it appears,
 * else each of its words, else Fuse's fuzzy runs of two or more characters.
 * Single-letter scraps of a fuzzy match read as noise, not as the reason for it.
 */
function readableRanges(text: string, query: string, fuzzy?: MatchRanges): MatchRanges {
  const haystack = text.toLowerCase();
  const phrase = query.trim().toLowerCase();
  if (phrase.length === 0) return [];

  const whole = occurrences(haystack, phrase);
  if (whole.length > 0) return whole;

  const words = phrase.split(/\s+/).filter((word) => word.length >= 2);
  const byWord = words.flatMap((word) => occurrences(haystack, word));
  if (byWord.length > 0) return byWord;

  return (fuzzy ?? []).filter(([start, end]) => end > start);
}

/** Every non-overlapping `[start, end]` span where `needle` occurs in `haystack`. */
function occurrences(haystack: string, needle: string): [number, number][] {
  const spans: [number, number][] = [];
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) {
    spans.push([at, at + needle.length - 1]);
  }
  return spans;
}

/** Wrap the given character ranges of `text` in a highlighted `<mark>`. */
function highlight(text: string, ranges: MatchRanges): ReactNode {
  if (ranges.length === 0) return text;

  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const nodes: ReactNode[] = [];
  let cursor = 0;
  sorted.forEach(([start, end], index) => {
    const from = Math.max(start, cursor);
    if (from > end) return;
    if (from > cursor) nodes.push(text.slice(cursor, from));
    nodes.push(
      <mark key={index} className="bg-primary/25 rounded-[2px] text-inherit">
        {text.slice(from, end + 1)}
      </mark>,
    );
    cursor = end + 1;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

/** Key legend. The Enter hint names what Enter does to the active row. */
function Footer({ active, loading }: { active?: SearchEntry; loading: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <span>
        <Key>↑</Key>
        <Key>↓</Key> navigate
      </span>
      <span>
        <Key>↵</Key> {enterVerb(active)}
      </span>
      <span>
        <Key>esc</Key> close
      </span>
      {loading ? <span className="ml-auto">Loading markets…</span> : null}
    </div>
  );
}

/** What Enter does to the active row, in the footer's words. */
function enterVerb(active?: SearchEntry): string {
  if (active?.type === "card") return "jump to card";
  if (active && splitHref(active.href).anchor) return "open flow";
  return "open page";
}

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="border-border/70 bg-muted/60 text-muted-foreground mr-1 inline-flex min-w-4 items-center justify-center rounded border px-1 font-sans text-[0.65rem]">
      {children}
    </kbd>
  );
}
