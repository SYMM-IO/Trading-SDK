"use client";
import { useMarkets } from "@symm-frontier/react";
import { useMemo } from "react";

/**
 * Build a `symbol_id → name` map from the solver's markets list, cached for the
 * lifetime of the underlying `useMarkets` query. Keys are stringified so callers
 * can look up by `bigint` or `number` via `String(symbolId)` without juggling
 * numeric types.
 */
export function useMarketNameById(): Map<string, string> {
  const { data } = useMarkets();
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const market of data ?? []) {
      if (market.symbol_id !== undefined && market.name) {
        map.set(String(market.symbol_id), market.name);
      }
    }
    return map;
  }, [data]);
}
