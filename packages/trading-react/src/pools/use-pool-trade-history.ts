"use client";

import {
  getPoolTradeHistoryQueryOptions,
  type ConfigParameter,
  type GetPoolTradeHistoryOptions,
  type GetPoolTradeHistoryReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link usePoolTradeHistory}: the core query options plus an optional `config`. */
export type UsePoolTradeHistoryParameters = GetPoolTradeHistoryOptions & ConfigParameter;

/** Return type of {@link usePoolTradeHistory}: the pool's realized history rows. */
export type UsePoolTradeHistoryReturnType = UseQueryResult<GetPoolTradeHistoryReturnType, SymmioRequestError>;

/**
 * Read a **pool's** realized trade history from the analytics subgraph.
 *
 * Each row is one close or liquidation event with that event's frozen snapshot
 * applied, so a quote closed in several partial closes yields several rows —
 * each showing the size and price of *that* close rather than the quote's final
 * state.
 *
 * Pool-wide: no account filter, so this is every trader's closes on the market.
 * The query stays idle while `symbolId` is absent. Errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = usePoolTradeHistory({ symbolId, first: 25 });
 * ```
 */
export function usePoolTradeHistory(parameters: UsePoolTradeHistoryParameters): UsePoolTradeHistoryReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getPoolTradeHistoryQueryOptions(config, {
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
  }) as UsePoolTradeHistoryReturnType;
}
