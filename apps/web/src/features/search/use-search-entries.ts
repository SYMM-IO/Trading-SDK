"use client";

import { useEnigmaPriceServiceSymbolsInfo, useMarkets } from "@theoldvarorg/react";
import { useMemo } from "react";
import type { SearchEntry } from "./search-entry";
import { STATIC_ENTRIES, marketEntries, symbolEntries } from "./search-sources";

/**
 * Assemble the full searchable corpus: the static routes/pages/methods plus the
 * dynamic markets and price-service symbols. The dynamic queries are gated on
 * `enabled` so they only fetch once the palette opens, never on every page load.
 */
export function useSearchEntries(enabled: boolean): { entries: SearchEntry[]; isLoadingDynamic: boolean } {
  const markets = useMarkets({ query: { enabled } });
  const symbols = useEnigmaPriceServiceSymbolsInfo({ query: { enabled } });

  const entries = useMemo(
    () => [...STATIC_ENTRIES, ...marketEntries(markets.data ?? []), ...symbolEntries(symbols.data ?? [])],
    [markets.data, symbols.data],
  );

  return { entries, isLoadingDynamic: markets.isLoading || symbols.isLoading };
}
