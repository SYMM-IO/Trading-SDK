"use client";

import { Badge } from "@symmio/ui/components/badge";
import { CommandPalette, type CommandPaletteGroup } from "@symmio/ui/components/command-palette";
import { cn } from "@symmio/ui/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SEARCH_TYPE_META, type SearchEntry, type SearchType } from "./search-entry";
import { createSearchIndex, rankEntries, type MatchRanges, type RankedEntry } from "./search-index";
import { useRecentSearches } from "./use-recent-searches";
import { useSearchEntries } from "./use-search-entries";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Singular type label shown as a row chip. */
const TYPE_CHIP: Record<SearchType, string> = {
  route: "Page",
  contract: "Contract",
  flow: "Flow",
  method: "Method",
  market: "Market",
  symbol: "Symbol",
};

/** Titles rendered in mono — identifiers rather than prose. */
const MONO_TYPES: ReadonlySet<SearchType> = new Set<SearchType>(["method", "market", "symbol"]);

/**
 * The app-wide command palette: a Fuse-ranked, weighted search over routes,
 * contract pages, methods, and live markets/symbols. An empty query shows recent
 * picks and quick navigation; typing ranks every source together and groups the
 * hits by kind. Selecting a row records it for recency and navigates.
 */
export function CommandSearch({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { entries, isLoadingDynamic } = useSearchEntries(open);
  const { recentIds, push } = useRecentSearches();

  const index = useMemo(() => createSearchIndex(entries), [entries]);
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const ranked = useMemo(() => rankEntries(index, query, { recentIds }), [index, query, recentIds]);

  /** Clear the field after the close animation settles, so it reopens empty. */
  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => setQuery(""), 150);
      return () => clearTimeout(id);
    }
  }, [open]);

  const groups = useMemo<CommandPaletteGroup[]>(() => {
    if (query.trim().length === 0) return restingGroups(recentIds, byId);
    return resultGroups(ranked);
  }, [query, ranked, recentIds, byId]);

  function handleSelect(id: string) {
    const entry = byId.get(id);
    if (!entry) return;
    push(id);
    onOpenChange(false);
    router.push(entry.href);
  }

  return (
    <CommandPalette
      open={open}
      onOpenChange={onOpenChange}
      query={query}
      onQueryChange={setQuery}
      groups={groups}
      onSelect={handleSelect}
      label="Search Symmio Frontier"
      placeholder="Search pages, methods, markets…"
      emptyState={isLoadingDynamic ? "Loading…" : "No matches. Try a method name, market, or symbol."}
      footer={<Footer loading={isLoadingDynamic} />}
    />
  );
}

/** Build the empty-query view: recently opened entries, then quick navigation. */
function restingGroups(recentIds: readonly string[], byId: Map<string, SearchEntry>): CommandPaletteGroup[] {
  const recent = recentIds.map((id) => byId.get(id)).filter((entry): entry is SearchEntry => Boolean(entry));
  const routes = [...byId.values()].filter((entry) => entry.type === "route");

  const groups: CommandPaletteGroup[] = [];
  if (recent.length > 0) groups.push({ id: "recent", heading: "Recent", items: recent.map((entry) => toItem(entry)) });
  groups.push({ id: "go-to", heading: "Go to", items: routes.map((entry) => toItem(entry)) });
  return groups;
}

/** Group ranked hits by type into fixed-order sections, items kept in score order. */
function resultGroups(ranked: readonly RankedEntry[]): CommandPaletteGroup[] {
  const buckets = new Map<SearchType, RankedEntry[]>();
  for (const hit of ranked) {
    const bucket = buckets.get(hit.entry.type) ?? [];
    bucket.push(hit);
    buckets.set(hit.entry.type, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => SEARCH_TYPE_META[a].order - SEARCH_TYPE_META[b].order)
    .map(([type, hits]) => ({
      id: type,
      heading: SEARCH_TYPE_META[type].heading,
      items: hits.map((hit) => toItem(hit.entry, hit)),
    }));
}

/**
 * Render one entry as a command row: a kind/type chip, the full-size title on its
 * own line, and the description on a second line — both with query matches marked.
 */
function toItem(entry: SearchEntry, ranked?: RankedEntry) {
  return {
    id: entry.id,
    label: (
      <>
        <RowChip entry={entry} />
        <div className="flex min-w-0 flex-col">
          <span
            className={cn(
              "truncate text-sm",
              MONO_TYPES.has(entry.type) ? "text-foreground font-mono" : "text-foreground font-medium",
            )}
          >
            {highlight(entry.title, ranked?.titleMatches)}
          </span>
          {entry.subtitle ? (
            <span className="text-muted-foreground truncate text-xs">
              {highlight(entry.subtitle, ranked?.subtitleMatches)}
            </span>
          ) : null}
        </div>
      </>
    ),
  };
}

/** The leading chip: a read/write badge for methods (matching the method cards), else a type tag. */
function RowChip({ entry }: { entry: SearchEntry }) {
  if (entry.type === "method" && entry.kind) {
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
      {TYPE_CHIP[entry.type]}
    </Badge>
  );
}

/** Wrap the character ranges that matched the query in a highlighted `<mark>`. */
function highlight(text: string, ranges?: MatchRanges): ReactNode {
  if (!ranges || ranges.length === 0) return text;

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

function Footer({ loading }: { loading: boolean }) {
  return (
    <div className="flex items-center gap-4">
      <span>
        <Key>↑</Key>
        <Key>↓</Key> navigate
      </span>
      <span>
        <Key>↵</Key> open
      </span>
      <span>
        <Key>esc</Key> close
      </span>
      {loading ? <span className="ml-auto">Loading markets…</span> : null}
    </div>
  );
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="border-border/70 bg-muted/60 text-muted-foreground mr-1 inline-flex min-w-4 items-center justify-center rounded border px-1 font-sans text-[0.65rem]">
      {children}
    </kbd>
  );
}
