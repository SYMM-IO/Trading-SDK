"use client";

import { MicroLabel } from "@/components/panel";
import { DataTable, EmptyState, SkeletonRows } from "@/components/table";
import type { Deployment, MarketFamily } from "@/config/deployments";
import { useTickSignal } from "@/features/prices/price-provider";
import { cn } from "@/lib/cn";
import type { MarketRowModel, MarketSort, MarketSortKey } from "./market-filters";
import { MarketRow } from "./market-row";
import type { PrismMarket } from "./types";

/**
 * The merged book's column template.
 *
 * Every track carries a `min-content` floor so a long lowcap ticker cannot
 * shift the grid out from under the numbers — the design system's rule for
 * every table in the app.
 */
export const MARKET_COLUMNS =
  "minmax(240px,2.4fr) minmax(112px,1fr) minmax(90px,0.8fr) minmax(112px,1fr) minmax(124px,1fr) minmax(76px,0.7fr) minmax(78px,min-content)";

/**
 * A deployment that failed, and how badly.
 *
 * `book` means its market list never arrived, so its rows are simply missing.
 * `figures` means the rows are here but a supporting read (24h info, notional
 * caps) failed, so some columns read `—`. Collapsing the two into one message
 * would overstate one and understate the other.
 */
export interface DeploymentFailure {
  deployment: Deployment;
  error: Error;
  kind: "book" | "figures";
}

export interface MarketTableProps {
  /** The rows to render — already filtered, sorted and windowed. */
  rows: readonly MarketRowModel[];
  /** How many rows matched before the render window cut them down. */
  matchCount: number;
  sort: MarketSort;
  onSort: (key: MarketSortKey) => void;
  /** True while the merged book is still loading its first response. */
  isLoading: boolean;
  /** True when a search query is active — changes what "empty" means. */
  hasQuery: boolean;
  /** Deployments that failed. Each gets an inline row naming its solver. */
  failures: readonly DeploymentFailure[];
  /** Live mark price lookup, called per row so every tick lands. */
  priceOf: (family: MarketFamily, name: string) => number | undefined;
  /** Open-interest lookup for the visible window. */
  openInterestOf: (market: PrismMarket) => number | undefined;
  /** Row keys that earned a `NEW` badge. */
  newKeys: ReadonlySet<string>;
  /** Open the ticket for a market. */
  onOpen: (entry: PrismMarket) => void;
  /** Widen the render window. Absent once every match is on screen. */
  onShowMore?: () => void;
}

/**
 * The merged book, as one table.
 *
 * There is no per-solver section, no tab, no toggle: majors and lowcaps are
 * interleaved by whatever column is sorted, and a row's only tell is its family
 * stripe. A failing deployment folds down to a single warn row and takes
 * nothing else with it.
 */
export function MarketTable({
  rows,
  matchCount,
  sort,
  onSort,
  isLoading,
  hasQuery,
  failures,
  priceOf,
  openInterestOf,
  newKeys,
  onOpen,
  onShowMore,
}: MarketTableProps) {
  /* Mark prices live in a subscription store, so reading them through
     `priceOf` does not on its own re-render anything. Subscribing here — and
     not in the screen — repaints the price column once a second without
     re-running the screen's filter and sort over the whole book. */
  useTickSignal();

  const head = (
    <>
      <SortHeader label="Market" sortKey="name" sort={sort} onSort={onSort} />
      {/* Mark price is not sortable — it ticks, and a self-reordering table
          under the cursor is unusable. */}
      <MicroLabel className="text-right">Mark price</MicroLabel>
      <SortHeader label="24h" sortKey="change" sort={sort} onSort={onSort} align="right" />
      <SortHeader label="24h volume" sortKey="volume" sort={sort} onSort={onSort} align="right" />
      <MicroLabel className="text-right">Open interest</MicroLabel>
      <SortHeader label="Max lev" sortKey="leverage" sort={sort} onSort={onSort} align="right" />
      <span className="sr-only">Trade</span>
    </>
  );

  return (
    <div className="min-w-0">
      <DataTable columns={MARKET_COLUMNS} head={head}>
        {failures.map((failure) => (
          <FailureRow key={failure.deployment.family} {...failure} />
        ))}

        {isLoading && rows.length === 0 ? <SkeletonRows columns={MARKET_COLUMNS} rows={8} cells={7} /> : null}

        {!isLoading && rows.length === 0 ? (
          <EmptyState
            title={hasQuery ? "Nothing matches that." : "No markets in scope."}
            body={
              hasQuery
                ? "Try a ticker or a contract address."
                : "Every in-scope solver returned an empty book. Switch the palette mode to widen the fan-out."
            }
          />
        ) : null}

        {rows.map((row) => (
          <MarketRow
            key={row.entry.key}
            row={row}
            columns={MARKET_COLUMNS}
            price={priceOf(row.entry.family, row.entry.market.name)}
            openInterest={openInterestOf(row.entry)}
            isNew={newKeys.has(row.entry.key)}
            onOpen={() => onOpen(row.entry)}
          />
        ))}
      </DataTable>

      {rows.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="text-xs text-fg-3">
            Showing <span className="tnum">{rows.length.toLocaleString("en-US")}</span> of{" "}
            <span className="tnum">{matchCount.toLocaleString("en-US")}</span> {matchCount === 1 ? "market" : "markets"}
            {onShowMore ? " — the rest are loaded, just not rendered." : null}
          </span>
          {onShowMore ? (
            <button
              type="button"
              onClick={onShowMore}
              className="ml-auto inline-flex h-7 cursor-pointer items-center justify-center rounded-sm border border-line bg-bg-2 px-3 text-sm font-semibold whitespace-nowrap text-fg-1 transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:border-line-strong hover:bg-bg-3 hover:text-fg-0"
            >
              Show more
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface SortHeaderProps {
  label: string;
  sortKey: MarketSortKey;
  sort: MarketSort;
  onSort: (key: MarketSortKey) => void;
  align?: "left" | "right";
}

/** A column head that sorts. The caret only appears on the active column. */
function SortHeader({ label, sortKey, sort, onSort, align = "left" }: SortHeaderProps) {
  const active = sort.key === sortKey;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 bg-transparent whitespace-nowrap",
        "transition-colors duration-[var(--dur-fast)] ease-[var(--ease-out)]",
        align === "right" ? "justify-end" : "justify-start",
        active ? "text-fg-1" : "text-fg-3 hover:text-fg-1",
      )}
    >
      <span className="text-2xs font-semibold tracking-[0.12em] uppercase">{label}</span>
      {active ? <Caret direction={sort.direction} /> : null}
    </button>
  );
}

/** Sort caret. Points the way the column is currently ordered. */
function Caret({ direction }: { direction: MarketSort["direction"] }) {
  return (
    <svg aria-hidden viewBox="0 0 8 5" className={cn("size-2 shrink-0", direction === "asc" ? "rotate-180" : null)}>
      <path d="M0 0h8L4 5z" fill="currentColor" />
    </svg>
  );
}

/**
 * One deployment fell over.
 *
 * It names the solver, the chain and the reason, then gets out of the way — the
 * other family's rows are still below it. Rendering an empty table instead
 * would claim there are no markets, which is a different and worse statement.
 */
function FailureRow({ deployment, error, kind }: DeploymentFailure) {
  return (
    <div className="flex items-start gap-2.5 border-b border-line-subtle bg-warn-bg px-4 py-2.5">
      <svg aria-hidden viewBox="0 0 16 16" className="mt-[2px] size-3.5 shrink-0 text-warn">
        <path d="M8 1.5 15 14H1L8 1.5Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M8 6v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="8" cy="12" r="0.8" fill="currentColor" />
      </svg>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold text-warn">
          {kind === "book"
            ? `${deployment.label} markets unavailable — ${deployment.solverName} on ${deployment.chainName} did not answer, so its rows are missing from this list.`
            : `${deployment.label} figures unavailable — ${deployment.solverName} on ${deployment.chainName} listed its markets but not their numbers.`}
        </span>
        <span className="truncate text-2xs text-fg-3">{error.message} · every other deployment is unaffected.</span>
      </div>
    </div>
  );
}
