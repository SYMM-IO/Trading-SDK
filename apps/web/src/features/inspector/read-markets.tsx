"use client";

import { ResultError, ResultNote } from "@/components/result";
import { TableSkeleton } from "@/components/skeletons";
import { useMarkets } from "@symm-frontier/react";
import { Badge } from "@symm-frontier/ui/components/badge";
import { Button } from "@symm-frontier/ui/components/button";
import { Input } from "@symm-frontier/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@symm-frontier/ui/components/select";
import { Spinner } from "@symm-frontier/ui/components/spinner";
import { useMemo, useState } from "react";
import { MethodCard } from "./method-card";

type Market = NonNullable<ReturnType<typeof useMarkets>["data"]>[number];
type SortKey = "symbol_id" | "max_leverage" | "trading_fee" | "name";

const SORT_LABELS: Record<SortKey, string> = {
  symbol_id: "ID",
  name: "Name",
  max_leverage: "Max leverage",
  trading_fee: "Trading fee",
};

const PAGE_SIZES = [5, 10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 5;

export function ReadMarkets() {
  const query = useMarkets();
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("symbol_id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  return (
    <MethodCard
      testId="method-getMarkets"
      name="getMarkets"
      mutability="view"
      description="Fetch all tradable markets (contract symbols) from the solver."
    >
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          data-testid="button-read-markets"
        >
          {query.isFetching ? <Spinner className="size-4" /> : <RefreshIcon />}
          {query.isFetching ? "Fetching…" : query.data ? "Refresh" : "Fetch markets"}
        </Button>
        {query.data ? (
          <span className="text-muted-foreground font-mono text-xs">
            {query.data.length} market{query.data.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      <ResultPanel
        testId="result-getMarkets"
        query={query}
        search={search}
        onSearch={setSearch}
        stateFilter={stateFilter}
        onStateFilter={setStateFilter}
        sortKey={sortKey}
        onSortKey={setSortKey}
        sortDir={sortDir}
        onToggleDir={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
      />
    </MethodCard>
  );
}

interface ResultPanelProps {
  testId: string;
  query: ReturnType<typeof useMarkets>;
  search: string;
  onSearch: (v: string) => void;
  stateFilter: string;
  onStateFilter: (v: string) => void;
  sortKey: SortKey;
  onSortKey: (v: SortKey) => void;
  sortDir: "asc" | "desc";
  onToggleDir: () => void;
}

function ResultPanel({
  testId,
  query,
  search,
  onSearch,
  stateFilter,
  onStateFilter,
  sortKey,
  onSortKey,
  sortDir,
  onToggleDir,
}: ResultPanelProps) {
  const visible = useMemo(() => {
    if (!query.data) return [];
    const term = search.trim().toLowerCase();
    const filtered = query.data.filter((m) => {
      const matchesTerm =
        term.length === 0 ||
        m.symbol?.toLowerCase().includes(term) ||
        m.name?.toLowerCase().includes(term) ||
        String(m.symbol_id).includes(term);
      const matchesState = stateFilter === "all" || m.state === Number(stateFilter);
      return matchesTerm && matchesState;
    });
    const sorted = [...filtered].sort((a, b) => {
      const cmp =
        sortKey === "name"
          ? (a.name ?? "").localeCompare(b.name ?? "")
          : Number((a as Record<string, unknown>)[sortKey] ?? 0) - Number((b as Record<string, unknown>)[sortKey] ?? 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [query.data, search, stateFilter, sortKey, sortDir]);

  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  /** Reset to the first page whenever the result set changes (filters, sort, or page size). */
  const resultSig = `${search}|${stateFilter}|${sortKey}|${sortDir}|${pageSize}`;
  const [prevSig, setPrevSig] = useState(resultSig);
  if (resultSig !== prevSig) {
    setPrevSig(resultSig);
    setPage(1);
  }

  if (query.isLoading) {
    return <TableSkeleton rows={6} columns={6} alignEndFrom={4} testId={`${testId}-loading`} />;
  }
  if (query.error) {
    return <ResultError testId={`${testId}-error`} kind={query.error.kind} message={query.error.message} />;
  }
  if (!query.data) {
    return <ResultNote testId={`${testId}-idle`}>Click the button to fetch markets.</ResultNote>;
  }
  if (query.data.length === 0) {
    return <ResultNote testId={`${testId}-empty`}>No markets found.</ResultNote>;
  }

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const paged = visible.slice(start, start + pageSize);

  return (
    <div data-testid={`${testId}-data`} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2">
            <SearchIcon />
          </span>
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search symbol, name, or ID…"
            className="pl-9"
            data-testid="markets-search"
            aria-label="Search markets"
          />
        </div>

        <Select value={stateFilter} onValueChange={onStateFilter}>
          <SelectTrigger className="sm:w-40" data-testid="markets-state-filter" aria-label="Filter by state">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            <SelectItem value="3">Enabled</SelectItem>
            <SelectItem value="2">Open only</SelectItem>
            <SelectItem value="1">Close only</SelectItem>
            <SelectItem value="0">Disabled</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Select value={sortKey} onValueChange={(v) => onSortKey(v as SortKey)}>
            <SelectTrigger className="sm:w-40" data-testid="markets-sort" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SORT_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={onToggleDir}
            aria-label={`Sort ${sortDir === "asc" ? "ascending" : "descending"}`}
            title={sortDir === "asc" ? "Ascending" : "Descending"}
            data-testid="markets-sort-dir"
          >
            <SortDirIcon dir={sortDir} />
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="border-border/60 bg-muted/20 text-muted-foreground rounded-xl border px-3 py-6 text-center text-sm">
          No markets match these filters.
        </div>
      ) : (
        <>
          <div className="border-border/70 overflow-hidden rounded-xl border">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/40 text-muted-foreground text-left text-xs font-medium tracking-wide uppercase">
                    <th className="px-3 py-2.5">ID</th>
                    <th className="px-3 py-2.5">Symbol</th>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">State</th>
                    <th className="px-3 py-2.5 text-right">Max leverage</th>
                    <th className="px-3 py-2.5 text-right">Trading fee</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((market) => (
                    <tr
                      key={market.symbol_id}
                      data-market-id={market.symbol_id}
                      className="border-border/60 hover:bg-muted/30 border-t transition-colors"
                    >
                      <td className="text-muted-foreground px-3 py-2.5 font-mono">{market.symbol_id}</td>
                      <td className="text-foreground px-3 py-2.5 font-mono font-medium">{market.symbol}</td>
                      <td className="text-foreground px-3 py-2.5">{market.name}</td>
                      <td className="px-3 py-2.5">
                        <MarketStateBadge state={market.state} />
                      </td>
                      <td className="text-foreground px-3 py-2.5 text-right font-mono">{market.max_leverage}×</td>
                      <td className="text-muted-foreground px-3 py-2.5 text-right font-mono">{market.trading_fee}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <PaginationControls
            page={safePage}
            pageCount={pageCount}
            pageSize={pageSize}
            total={visible.length}
            grandTotal={query.data.length}
            onPage={setPage}
            onPageSize={setPageSize}
          />
        </>
      )}
    </div>
  );
}

interface PaginationControlsProps {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  grandTotal: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}

function PaginationControls({
  page,
  pageCount,
  pageSize,
  total,
  grandTotal,
  onPage,
  onPageSize,
}: PaginationControlsProps) {
  const isFirst = page <= 1;
  const isLast = page >= pageCount;
  const start = (page - 1) * pageSize;
  return (
    <div
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid="markets-pagination"
    >
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-xs">Rows per page</span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSize(Number(v))}>
          <SelectTrigger className="w-[72px]" data-testid="markets-page-size" aria-label="Rows per page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <span className="text-muted-foreground text-xs" data-testid="markets-range">
        Showing{" "}
        <span className="text-foreground font-medium">
          {start + 1}–{Math.min(start + pageSize, total)}
        </span>{" "}
        of {total}
        {total === grandTotal ? null : ` (filtered from ${grandTotal})`}
      </span>

      <div className="flex items-center gap-1">
        <span className="text-muted-foreground mr-2 text-xs" data-testid="markets-page-indicator">
          Page <span className="text-foreground font-medium">{page}</span> of {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={isFirst}
          onClick={() => onPage(1)}
          aria-label="First page"
          title="First page"
          data-testid="markets-page-first"
        >
          <ChevronFirstIcon />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={isFirst}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
          title="Previous page"
          data-testid="markets-page-prev"
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={isLast}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
          title="Next page"
          data-testid="markets-page-next"
        >
          <ChevronRightIcon />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={isLast}
          onClick={() => onPage(pageCount)}
          aria-label="Last page"
          title="Last page"
          data-testid="markets-page-last"
        >
          <ChevronLastIcon />
        </Button>
      </div>
    </div>
  );
}

function MarketStateBadge({ state }: { state: Market["state"] }) {
  const map: Record<number, { label: string; variant: "positive" | "secondary" | "destructive" | "warning" }> = {
    0: { label: "Disabled", variant: "destructive" },
    1: { label: "Close only", variant: "warning" },
    2: { label: "Open only", variant: "secondary" },
    3: { label: "Enabled", variant: "positive" },
  };
  const entry = map[state ?? -1];
  if (!entry) return <Badge variant="outline">Unknown ({state})</Badge>;
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
      <path
        d="M13 8a5 5 0 1 1-1.5-3.5M13 2v3h-3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
      <circle cx="7" cy="7" r="4.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
      <path
        d="M10 3.5 5.5 8l4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronFirstIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
      <path
        d="M11.5 3.5 7 8l4.5 4.5M5 3.5v9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronLastIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
      <path
        d="M4.5 3.5 9 8l-4.5 4.5M11 3.5v9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SortDirIcon({ dir }: { dir: "asc" | "desc" }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
      {dir === "asc" ? (
        <path
          d="M8 12.5V3.5M4.5 7 8 3.5 11.5 7"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M8 3.5v9M4.5 9 8 12.5 11.5 9"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
