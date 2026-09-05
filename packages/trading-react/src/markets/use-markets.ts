"use client";

import {
  getMarketsQueryOptions,
  type ConfigParameter,
  type GetMarketsData,
  type GetMarketsOptions,
  type SymmioSolverKind,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useMarkets}: the core query options (chain id, solver
 * kind, TanStack `query` overrides) plus an optional `config`. Generic over the
 * solver kind `K` — a literal `solverId` narrows the returned market type.
 */
export type UseMarketsParameters<K extends SymmioSolverKind = SymmioSolverKind> = GetMarketsOptions<K> &
  ConfigParameter;

/** Return type of {@link useMarkets}, generic over the solver kind `K`. */
export type UseMarketsReturnType<K extends SymmioSolverKind = SymmioSolverKind> = UseQueryResult<
  GetMarketsData<K>,
  SymmioRequestError
>;

/**
 * Fetch all tradable markets (contract symbols) from the chain's solver,
 * normalized to the SDK `Market` shape.
 *
 * Pass a literal `solverId` to narrow the returned market type to that solver
 * (`useMarkets({ solverId: "rasa" })` → `RasaMarket[]`); omit it to get the
 * `Market` union and narrow on `kind` at the use site.
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
export function useMarkets<K extends SymmioSolverKind = SymmioSolverKind>(
  parameters: UseMarketsParameters<K> = {},
): UseMarketsReturnType<K> {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getMarketsQueryOptions<K>(config, {
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
  }) as UseMarketsReturnType<K>;
}
