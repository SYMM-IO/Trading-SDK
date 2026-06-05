"use client";

import {
  getMarketsQueryOptions,
  type ConfigParameter,
  type GetMarketsOptions,
  type SymbolContractSymbol,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useMarkets}: the core query options (chain id, TanStack
 * `query` overrides) plus an optional `config`.
 */
export type UseMarketsParameters = GetMarketsOptions & ConfigParameter;

/** Return type of {@link useMarkets}. */
export type UseMarketsReturnType = UseQueryResult<SymbolContractSymbol[], SymmioRequestError>;

/**
 * Fetch all tradable markets (contract symbols) from the chain's solver.
 *
 * Returns react-query's full {@link UseQueryResult}. Errors are normalized to
 * {@link SymmioRequestError} so `error.kind` is always a documented value.
 *
 * @example
 * ```tsx
 * const { data: markets, isLoading, error } = useMarkets();
 * if (isLoading) return <Spinner />;
 * if (error) return <ErrorView kind={error.kind} message={error.message} />;
 * return <MarketList items={markets ?? []} />;
 * ```
 */
export function useMarkets(parameters: UseMarketsParameters = {}): UseMarketsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getMarketsQueryOptions(config, {
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
  }) as UseMarketsReturnType;
}
