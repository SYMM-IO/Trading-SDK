"use client";

import { Chips } from "@/components/chips";
import { MicroLabel, Panel, PanelHeader } from "@/components/panel";
import { SearchInput } from "@/components/search-input";
import type { MarketFamily } from "@/config/deployments";
import { usePrismMode } from "@/features/mode/mode-provider";
import { usePrismPrices } from "@/features/prices/price-provider";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_MARKET_SORT,
  filterRows,
  nextSort,
  sortRows,
  toRowModels,
  type MarketFilter,
  type MarketSortKey,
} from "./market-filters";
import type { DeploymentFailure } from "./market-table";
import { MarketTable } from "./market-table";
import { MarketsSummary } from "./markets-summary";
import { newListingKeys } from "./new-listings";
import type { PrismMarket } from "./types";
import { useMarketStats } from "./use-market-stats";
import { useMergedMarkets } from "./use-merged-markets";
import { useOpenInterest } from "./use-open-interest";
import { usePoolMetadata } from "./use-pool-metadata";

/** Rows rendered per page. The rest stay in memory, out of the DOM. */
const PAGE_SIZE = 50;

/**
 * The discovery surface: one book, both solvers.
 *
 * Everything on this screen is the same shape whichever deployment served it —
 * one table, one sort, one search. The palette mode decides which solvers are
 * *read*; in unified mode the chips decide which of the merged rows are
 * *shown*. A single-deployment palette has already made that choice, so the
 * chips do not render there.
 */
export function MarketsScreen() {
  const router = useRouter();
  const { deployments, isUnified } = usePrismMode();
  const { priceOf } = usePrismPrices();

  const [filter, setFilter] = useState<MarketFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(DEFAULT_MARKET_SORT);
  const [pages, setPages] = useState(1);

  const { markets, isLoading, failures } = useMergedMarkets();
  const stats = useMarketStats();

  /* The chips only exist in unified mode: a single-deployment palette has
     already narrowed the fan-out, so "All" and that one family select the same
     rows. Resetting on the way out also stops a stale family from stranding an
     empty table when the palette comes back to unified. */
  useEffect(() => {
    if (!isUnified) setFilter("all");
  }, [isUnified]);

  const activeFilter: MarketFilter = isUnified ? filter : "all";

  /* Pool-priced markets publish no change through market-info, so their 24h
     figure comes from the pool. Resolved for every in-scope market rather than
     just the rendered window, so sorting by 24h change stays correct. */
  const pools = usePoolMetadata(markets);
  const rowModels = useMemo(
    () => toRowModels(markets, stats.statOf, pools.changeOf),
    [markets, stats.statOf, pools.changeOf],
  );

  const matched = useMemo(
    () => sortRows(filterRows(rowModels, activeFilter, query), sort),
    [rowModels, activeFilter, query, sort],
  );

  const visible = useMemo(() => matched.slice(0, pages * PAGE_SIZE), [matched, pages]);

  /* Open interest follows the render window: one list call covers the lowcap
     book, and the majors rows on screen are read a symbol at a time. */
  const visibleMarkets = useMemo(() => visible.map((row) => row.entry), [visible]);
  const openInterest = useOpenInterest(visibleMarkets);

  const newKeys = useMemo(() => newListingKeys(markets), [markets]);

  /* One warn row per broken deployment, not one per broken read. A solver that
     drops its market list has already failed harder than one that only lost its
     volume figures, so the book failure wins the slot. */
  const tableFailures = useMemo<DeploymentFailure[]>(() => {
    const byFamily = new Map<MarketFamily, DeploymentFailure>();
    for (const failure of failures) {
      byFamily.set(failure.deployment.family, { ...failure, kind: "book" });
    }
    for (const failure of [...stats.failures, ...openInterest.failures]) {
      if (byFamily.has(failure.deployment.family)) continue;
      byFamily.set(failure.deployment.family, { ...failure, kind: "figures" });
    }
    return [...byFamily.values()];
  }, [failures, stats.failures, openInterest.failures]);

  const chipOptions = useMemo(() => ["All", ...deployments.map((deployment) => deployment.label)], [deployments]);

  const chipValue =
    activeFilter === "all"
      ? "All"
      : (deployments.find((deployment) => deployment.family === activeFilter)?.label ?? "All");

  const handleChip = useCallback(
    (label: string) => {
      const picked = deployments.find((deployment) => deployment.label === label);
      setFilter(picked ? picked.family : "all");
      setPages(1);
    },
    [deployments],
  );

  const handleQuery = useCallback((next: string) => {
    setQuery(next);
    setPages(1);
  }, []);

  const handleSort = useCallback((key: MarketSortKey) => {
    setSort((current) => nextSort(current, key));
    setPages(1);
  }, []);

  const handleOpen = useCallback(
    (entry: PrismMarket) => {
      router.push(`/?market=${encodeURIComponent(entry.key)}`);
    },
    [router],
  );

  const hasMore = visible.length < matched.length;

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-5">
      <div className="flex flex-col gap-1">
        <MicroLabel>Discovery</MicroLabel>
        <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-fg-0">One book, every perp</h1>
        <p className="max-w-[72ch] text-md text-fg-2">
          Deep majors and unlisted microcaps in a single list, merged from two solvers on two chains. Sort it, search
          it, trade it — the row already knows where it settles.
        </p>
      </div>

      <MarketsSummary markets={markets} isLoading={isLoading} volume24hOf={stats.volume24hOf} />

      <Panel>
        <PanelHeader
          eyebrow="Merged book"
          title="Markets"
          actions={
            <SearchInput
              value={query}
              onChange={handleQuery}
              placeholder="Search BTC, WIF, 0x…"
              ariaLabel="Search markets"
              className="w-[240px]"
            />
          }
        />

        {isUnified ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-subtle px-4 py-2.5">
            <Chips className="shrink-0" options={chipOptions} value={chipValue} onChange={handleChip} />
            <p className="min-w-0 text-2xs text-fg-3">
              Mode reads both deployments — these chips only narrow what is already merged, and never change the
              palette.
            </p>
          </div>
        ) : null}

        <MarketTable
          rows={visible}
          matchCount={matched.length}
          sort={sort}
          onSort={handleSort}
          isLoading={isLoading}
          hasQuery={query.trim().length > 0}
          failures={tableFailures}
          priceOf={priceOf}
          openInterestOf={openInterest.openInterestOf}
          newKeys={newKeys}
          onOpen={handleOpen}
          onShowMore={hasMore ? () => setPages((current) => current + 1) : undefined}
        />
      </Panel>

      <div className="flex flex-col gap-1.5 px-1">
        <p className="max-w-[104ch] text-2xs text-fg-3">
          Open interest is not one number. Lowcaps comes from Enigma’s single
          <span className="font-mono"> /notional_cap </span>
          list call — the whole book in one request. Majors has no list endpoint on Rasa, so it is read per symbol for
          the rows on screen and reports notional used against the market’s cap. 24h change is Rasa-only for the same
          reason: Enigma’s market-info publishes volume, not a price delta.
        </p>
        <p className="text-md text-fg-3">
          Every market routes to the funding account that can trade it. You never pick one.
        </p>
      </div>
    </div>
  );
}
