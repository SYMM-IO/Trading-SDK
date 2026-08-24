"use client";

import { SymmioSupportedChainId, type RasaMarket } from "@symmio/trading-core";
import { useMarkets, type SymmioRequestError } from "@symmio/trading-react";
import { useMemo } from "react";
import { toMarketPickerList } from "./market-list";

/** What {@link useMajorMarkets} returns. */
export interface UseMajorMarketsReturn {
  /** One market per name, deepest first. */
  markets: RasaMarket[];
  /** The same list as plain market names, for pickers that only need labels. */
  names: string[];
  /** The solver's market list is still loading. */
  isLoading: boolean;
  /** The solver rejected or failed the request. */
  error: SymmioRequestError | null;
}

/**
 * The majors: every market Rasa lists, deduped and ordered for a picker.
 *
 * Pinned to Rasa on Base rather than following the connected wallet on purpose.
 * Rasa is the majors solver, and majors are exactly the markets a reference
 * exchange also lists — which is what the Binance-backed candle and orderbook
 * sources need. The other configured deployment (Enigma on HyperEVM) trades
 * lowcaps, which have no exchange listing at all and chart from their liquidity
 * pool instead, so they are a different card rather than a filtered-out half of
 * this list.
 *
 * @example
 * ```tsx
 * const majors = useMajorMarkets();
 * <MarketSelect items={majors.names.map((name) => ({ id: name, label: name }))} />;
 * ```
 */
export function useMajorMarkets(): UseMajorMarketsReturn {
  const query = useMarkets({ chainId: SymmioSupportedChainId.BASE, solverId: "rasa" });

  const markets = useMemo(() => toMarketPickerList(query.data ?? []), [query.data]);
  const names = useMemo(() => markets.map((market) => market.name), [markets]);

  return { markets, names, isLoading: query.isLoading, error: query.error };
}
