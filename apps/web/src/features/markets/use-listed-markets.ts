"use client";

import type { MarketSelectItem } from "@symmio/ui/components/market-select";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

/**
 * The slice of a `CandleSource` / `OrderbookSource` this filter needs: an id to
 * scope the cache with, and the source's own answer to "do you carry this
 * market". Structural on purpose — candles and orderbooks share it.
 */
export interface MarketListingSource {
  /** Stable source id, e.g. `"binance:usd-m-futures"`. */
  readonly id: string;
  /** Resolves to `undefined` for a market the source does not carry. */
  getSymbol(marketName: string): Promise<object | undefined>;
}

interface Params {
  source: MarketListingSource;
  /** Candidate market names, in the order they should appear. */
  names: readonly string[];
  /** The picker's current value. Always offered, so the field never blanks out. */
  selected: string;
}

/**
 * Narrow a list of market names to the ones a source actually carries, as
 * ready-to-render {@link MarketSelectItem}s.
 *
 * `getSymbol` is the source's own listing check, and every call shares one
 * cached `exchangeInfo` fetch, so filtering hundreds of names costs a single
 * request. Without it the picker would offer markets whose chart or book comes
 * back as a raw HTTP error, when the honest answer is "wrong source for this
 * market".
 *
 * @param params - The source, the candidate names, and the current selection.
 * @returns Picker items and whether the filter is still running.
 */
export function useListedMarkets({ source, names, selected }: Params): {
  items: MarketSelectItem[];
  isLoading: boolean;
} {
  const listed = useQuery({
    queryKey: ["listed-markets", source.id, names],
    queryFn: async () => {
      const symbols = await Promise.all(names.map((name) => source.getSymbol(name)));
      return names.filter((_, index) => symbols[index] !== undefined);
    },
    enabled: names.length > 0,
    staleTime: Infinity,
  });

  const items = useMemo<MarketSelectItem[]>(() => {
    const listedNames = listed.data ?? [];
    /** Keep the selection selectable while the filter runs, and if it fails. */
    const withSelected = selected && !listedNames.includes(selected) ? [selected, ...listedNames] : listedNames;

    return withSelected.map((name) => ({ id: name, label: name }));
  }, [listed.data, selected]);

  return { items, isLoading: listed.isLoading };
}
