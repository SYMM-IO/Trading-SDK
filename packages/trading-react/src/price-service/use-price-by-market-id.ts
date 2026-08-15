"use client";

import type { ConfigParameter, MarkPriceTick, SocketStatus, SolverId } from "@symmio/trading-core";
import { useMemo } from "react";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useMarkets } from "../markets/use-markets";
import { usePriceByName } from "./use-price-by-name";
import type { UsePricesRestFallback } from "./use-prices";

/**
 * Parameters for {@link usePriceByMarketId}.
 */
export interface UsePriceByMarketIdParameters extends ConfigParameter {
  /** Solver market id (`symbol_id`). */
  marketId: number | bigint | string;
  /** Target chain id. Defaults to the SDK's active chain. */
  chainId?: number;
  /** Solver whose markets and price provider serve this id. Defaults to the chain's default solver. */
  solverId?: SolverId;
  /** Subscribe only when `true` (and the market resolves). Default `true`. */
  enabled?: boolean;
  /** REST snapshot polling while the socket is degraded. See {@link usePrices}. */
  restFallback?: UsePricesRestFallback;
}

/**
 * Value returned by {@link usePriceByMarketId}.
 */
export interface UsePriceByMarketIdReturnType {
  /** Latest mark price for the resolved market, or `null` until the first tick. */
  markPrice: string | null;
  /** Symbol name resolved from {@link useMarkets}, or `null` if not found yet. */
  marketName: string | null;
  /** The full tick, for provider-specific fields. Narrow on `provider`. */
  tick: MarkPriceTick | null;
  /** Live socket status. */
  status: SocketStatus;
  /** Last transport/parse error, normalized, or `null`. */
  error: SymmioRequestError | null;
  /** True while markets are loading or the price has not ticked yet. */
  isLoading: boolean;
}

function toMarketIdNumber(value: number | bigint | string): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  return Number(value);
}

/**
 * Stream the live mark price for a market resolved by its solver `symbol_id`,
 * from **whichever price provider serves the resolved solver** — Enigma on a
 * lowcap chain, Binance USD-M Futures on a majors chain.
 *
 * Composes {@link useMarkets} (to translate `marketId → name`) with
 * {@link usePriceByName} (to subscribe to just that symbol on the resolved
 * provider). This is the provider-agnostic replacement for
 * `useEnigmaPriceByMarketId`, which asserts an Enigma price service and
 * therefore fails on chains priced by Binance.
 *
 * @example
 * ```tsx
 * const { markPrice, marketName, isLoading } = usePriceByMarketId({ marketId: 132 });
 * ```
 */
export function usePriceByMarketId(parameters: UsePriceByMarketIdParameters): UsePriceByMarketIdReturnType {
  const { marketId, chainId, solverId, enabled = true, ...rest } = parameters;

  const marketsQuery = useMarkets({ chainId, solverId, ...rest });
  const targetId = useMemo(() => toMarketIdNumber(marketId), [marketId]);

  const marketName = useMemo<string | null>(() => {
    if (!marketsQuery.data) return null;
    const market = marketsQuery.data.find((entry) => entry.symbolId === targetId);
    return market?.name ?? null;
  }, [marketsQuery.data, targetId]);

  const priceQuery = usePriceByName({
    ...rest,
    chainId,
    solverId,
    name: marketName ?? undefined,
    enabled: enabled && marketName !== null,
  });

  return {
    markPrice: priceQuery.markPrice,
    marketName,
    tick: priceQuery.tick,
    status: priceQuery.status,
    error: priceQuery.error,
    isLoading: marketsQuery.isLoading || (marketName !== null && priceQuery.markPrice === null),
  };
}
