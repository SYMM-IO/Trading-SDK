"use client";

import { ListingMarketStatus, type ListingMarket } from "@symmio/trading-core";
import { useListingMarkets } from "@symmio/trading-react";
import { MarketSelect, type MarketSelectItem } from "@symmio/ui/components/market-select";
import { useEffect, useMemo, useState } from "react";
import { depositChainLabel } from "./format-listing-value";
import { useDebouncedValue } from "./use-debounced-value";

/** Page size for the pool picker — the listing service's default. */
const PAGE_SIZE = 20;

interface Props {
  /** Namespaces the picker's ids and test ids. */
  idPrefix: string;
  /** Selected pool's `contractAddress`, or `""` when none. */
  value: string;
  /** Fired with the picked `contractAddress` (or `""` on clear). */
  onValueChange: (contractAddress: string) => void;
  /** Fired with the picked market row (or `null`), for callers that need more than the address — e.g. its `chainId`. */
  onSelectedMarketChange?: (market: ListingMarket | null) => void;
  /** Gate the underlying catalog read; the picker stays inert (and empty) when `false`. */
  enabled?: boolean;
}

/**
 * Pool picker over the listing catalog — searches the backend and pages more
 * pools in as you scroll, instead of loading one fixed page and filtering it in
 * the browser.
 *
 * Search is server-side (debounced) and results accumulate page by page: the
 * `MarketSelect` reports typing and scroll-to-end back up here, driving the
 * existing `useListingMarkets` `search` / `limit` / `offset`. The picked market is
 * retained so its label stays put even after a later search drops it from the
 * loaded pages.
 */
export function PoolSelect({ idPrefix, value, onValueChange, onSelectedMarketChange, enabled = true }: Props) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [offset, setOffset] = useState(0);
  const [loaded, setLoaded] = useState<ListingMarket[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<ListingMarket | null>(null);

  // A new search term starts the list over from the first page.
  useEffect(() => {
    setOffset(0);
    setLoaded([]);
  }, [debouncedSearch]);

  const markets = useListingMarkets({
    marketStatus: ListingMarketStatus.LISTED,
    search: debouncedSearch === "" ? undefined : debouncedSearch,
    limit: PAGE_SIZE,
    offset,
    query: { enabled, placeholderData: (previous) => previous },
  });

  // Accumulate pages: the first page replaces, later pages append (de-duped).
  useEffect(() => {
    const page = markets.data;
    if (!page) return;
    setLoaded((previous) => (page.offset === 0 ? page.items : mergeUnique(previous, page.items)));
  }, [markets.data]);

  const total = markets.data?.total ?? 0;
  const hasMore = loaded.length < total;

  const items = useMemo(() => {
    // Keep the picked market present even when a later search excludes it, so the
    // trigger keeps its label and the checkmark stays.
    const rows =
      selectedMarket && !loaded.some((market) => market.contractAddress === selectedMarket.contractAddress)
        ? [selectedMarket, ...loaded]
        : loaded;
    return rows.map(toMarketSelectItem);
  }, [loaded, selectedMarket]);

  function handleValueChange(next: string) {
    onValueChange(next);
    const market =
      loaded.find((row) => row.contractAddress === next) ??
      (selectedMarket?.contractAddress === next ? selectedMarket : null);
    setSelectedMarket(market);
    onSelectedMarketChange?.(market);
  }

  return (
    <MarketSelect
      idPrefix={idPrefix}
      value={value}
      items={items}
      onValueChange={handleValueChange}
      searchValue={search}
      onSearchChange={setSearch}
      loading={markets.isPending || (markets.isFetching && offset === 0)}
      hasMore={hasMore}
      loadingMore={markets.isFetching && offset > 0}
      onEndReached={() => {
        if (hasMore && !markets.isFetching) setOffset((current) => current + PAGE_SIZE);
      }}
      disabled={!enabled}
      placeholder={enabled && markets.isPending ? "Loading pools..." : "Select a pool..."}
      searchPlaceholder="Search ticker, name or address..."
      emptyLabel="No listed pools."
      emptyResultsLabel="No pools match this search."
      clearLabel="Clear pool"
    />
  );
}

/** Map a listing row to a combobox item keyed by `contractAddress`. */
function toMarketSelectItem(market: ListingMarket): MarketSelectItem {
  return {
    id: market.contractAddress,
    label: `${market.tokenTicker} · ${market.tokenName} (${depositChainLabel(market.chainId)})`,
    searchText: [market.tokenTicker, market.tokenName, market.contractAddress].join(" "),
  };
}

/** Append `next` onto `previous`, dropping rows already present by `contractAddress`. */
function mergeUnique(previous: ListingMarket[], next: ListingMarket[]): ListingMarket[] {
  const seen = new Set(previous.map((market) => market.contractAddress));
  return [...previous, ...next.filter((market) => !seen.has(market.contractAddress))];
}
