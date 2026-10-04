"use client";
import { DEFAULT_PRICE_PRECISION, DEFAULT_QUANTITY_PRECISION } from "@/lib/format";
import { useMarkets } from "@symmio/trading-react";
import { useMemo } from "react";

/** Display metadata a quote row needs about its market. */
export interface MarketDisplay {
  /** Solver-reported market name, or the raw `symbolId` when the markets list has not loaded. */
  name: string;
  /** Decimal places for a price in this market. */
  pricePrecision: number;
  /** Decimal places for a quantity in this market. */
  quantityPrecision: number;
}

/** Resolves {@link MarketDisplay} for any `symbolId`. */
export type MarketDisplayLookup = (symbolId: bigint) => MarketDisplay;

/**
 * One `useMarkets` read turned into a `symbolId → ` {@link MarketDisplay} lookup.
 *
 * A quote list needs a market's name *and* both of its decimal precisions on
 * every row, and resolving them separately means a second pass over the markets
 * array per row. This builds the map once and hands back a lookup that falls back
 * to the raw id and the app defaults, so a row never blocks on the markets query.
 *
 * @example
 * ```tsx
 * const marketOf = useMarketDisplay();
 * const { name, pricePrecision } = marketOf(quote.symbolId);
 * ```
 */
export function useMarketDisplay(): MarketDisplayLookup {
  const { data } = useMarkets();
  return useMemo(() => {
    const byId = new Map<string, MarketDisplay>();
    for (const market of data ?? []) {
      byId.set(String(market.symbolId), {
        name: market.name || String(market.symbolId),
        pricePrecision: market.pricePrecision ?? DEFAULT_PRICE_PRECISION,
        quantityPrecision: market.quantityPrecision ?? DEFAULT_QUANTITY_PRECISION,
      });
    }
    return (symbolId: bigint) =>
      byId.get(String(symbolId)) ?? {
        name: String(symbolId),
        pricePrecision: DEFAULT_PRICE_PRECISION,
        quantityPrecision: DEFAULT_QUANTITY_PRECISION,
      };
  }, [data]);
}
