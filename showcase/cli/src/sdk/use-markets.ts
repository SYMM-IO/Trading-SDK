import { getMarkets, type Market } from "@symmio/trading-core";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useSdkScope } from "./use-sdk-scope.js";

/** A market's tradable state, from the solver catalog `state` field. */
export function isTradable(market: Market): boolean {
  if (!market.isValid || !market.rfqAllowed) return false;
  return market.kind === "rasa" || market.state === 2 || market.state === 3;
}

/** The solver market catalog, sorted by symbol. Public read — no wallet. */
export function useMarkets() {
  const { config, chainId, solverId } = useSdkScope();
  return useQuery({
    queryKey: ["markets", chainId, solverId],
    queryFn: async () => {
      const markets = await getMarkets(config, { chainId, solverId });
      return [...markets].sort((a, b) => a.symbol.localeCompare(b.symbol));
    },
    staleTime: 60_000,
  });
}

/** Concise per-symbol metadata the UI needs everywhere. */
export interface MarketMeta {
  symbolId: number;
  name: string;
  symbol: string;
  pricePrecision: number;
  quantityPrecision: number;
  maxLeverage: number;
  tokenAddress?: string;
  market: Market;
}

/** Normalize a raw catalog entry to the concise metadata the UI reads. */
export function toMarketMeta(market: Market): MarketMeta {
  return {
    symbolId: market.symbolId,
    name: market.name,
    symbol: market.symbol,
    pricePrecision: market.pricePrecision,
    quantityPrecision: market.quantityPrecision,
    maxLeverage: market.maxLeverage,
    tokenAddress: market.kind === "enigma" ? market.tokenAddress : undefined,
    market,
  };
}

/**
 * A `symbolId → MarketMeta` lookup built from the catalog. Positions and quotes
 * carry only a `symbolId`; this resolves it to a name and the precisions every
 * sizing/formatting call needs.
 */
export function useMarketLookup() {
  const query = useMarkets();
  const byId = useMemo(() => {
    const map = new Map<string, MarketMeta>();
    for (const market of query.data ?? []) {
      const meta = toMarketMeta(market);
      map.set(String(meta.symbolId), meta);
    }
    return map;
  }, [query.data]);

  return { byId, isLoading: query.isLoading };
}
