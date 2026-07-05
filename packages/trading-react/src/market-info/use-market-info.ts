"use client";

import {
  getMarketInfoQueryOptions,
  type ConfigParameter,
  type GetMarketInfoOptions,
  type GetMarketInfoReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useMarketInfo}: the core query options plus an optional
 * `config`.
 */
export type UseMarketInfoParameters = GetMarketInfoOptions & ConfigParameter;

/** Return type of {@link useMarketInfo}. */
export type UseMarketInfoReturnType = UseQueryResult<GetMarketInfoReturnType, SymmioRequestError>;

/**
 * Read per-market 24h volume from the active chain's solver in one call.
 * Surfaces the rolling 24-hour trading volume and cumulative lifetime value for
 * every market, plus the aggregate totals across all markets.
 *
 * Does not poll by default; pass `query.refetchInterval` to opt into polling.
 * Errors are normalized to {@link SymmioRequestError} so `error.kind` is always
 * a documented value.
 *
 * @example
 * ```tsx
 * const { data } = useMarketInfo();
 * const btc = data?.markets.find((m) => m.symbol === "BTCUSDT");
 * console.log(btc?.tradingVolume, data?.totalValue24h);
 * ```
 */
export function useMarketInfo(parameters: UseMarketInfoParameters = {}): UseMarketInfoReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getMarketInfoQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseMarketInfoReturnType;
}
