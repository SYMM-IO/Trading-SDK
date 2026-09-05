"use client";

import type { ConfigParameter, SocketStatus } from "@symmio/trading-core";
import { useMemo } from "react";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useMarkets } from "../markets/use-markets";
import { useEnigmaPriceByName } from "./use-enigma-price-by-name";

/**
 * Parameters for {@link useEnigmaPriceByMarketId}.
 */
export interface UseEnigmaPriceByMarketIdParameters extends ConfigParameter {
  /** Solver market id (`symbol_id`). */
  marketId: number | bigint | string;
  /** Target chain id. Defaults to the SDK's active chain. */
  chainId?: number;
  /** Subscribe only when `true` (and the market resolves). Default `true`. */
  enabled?: boolean;
}

/**
 * Value returned by {@link useEnigmaPriceByMarketId}.
 */
export interface UseEnigmaPriceByMarketIdReturnType {
  /** Latest mark price for the resolved market, or `null` until the first tick. */
  markPrice: string | null;
  /** Symbol name resolved from `useMarkets`, or `null` if not found yet. */
  marketName: string | null;
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
 * **from the Enigma price service only**.
 *
 * Composes {@link useMarkets} (to translate `marketId → name`) with
 * {@link useEnigmaPriceByName} (to subscribe to just that symbol). Re-renders
 * only when this market's price actually changes.
 *
 * @deprecated Use `usePriceByMarketId` — it resolves the same market and price
 * from whichever provider serves the chain's solver, so it also works on
 * Binance-priced chains where this hook throws `UNSUPPORTED_BY_PRICE_SERVICE`.
 * This hook will be removed in the next major release.
 *
 * @example
 * ```tsx
 * const { markPrice, marketName, isLoading } = useEnigmaPriceByMarketId({ marketId: 132 });
 * ```
 */
export function useEnigmaPriceByMarketId(
  parameters: UseEnigmaPriceByMarketIdParameters,
): UseEnigmaPriceByMarketIdReturnType {
  const { marketId, chainId, enabled = true, ...rest } = parameters;

  const marketsQuery = useMarkets({ chainId, ...rest });
  const targetId = useMemo(() => toMarketIdNumber(marketId), [marketId]);

  const marketName = useMemo<string | null>(() => {
    if (!marketsQuery.data) return null;
    const market = marketsQuery.data.find((m) => m.symbolId === targetId);
    return market?.name ?? null;
  }, [marketsQuery.data, targetId]);

  const priceQuery = useEnigmaPriceByName({
    ...rest,
    chainId,
    name: marketName ?? "",
    enabled: enabled && marketName !== null,
  });

  return {
    markPrice: priceQuery.markPrice,
    marketName,
    status: priceQuery.status,
    error: priceQuery.error,
    isLoading: marketsQuery.isLoading || (marketName !== null && priceQuery.markPrice === null),
  };
}
