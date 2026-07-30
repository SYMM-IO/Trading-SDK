import type { SymmioSolverKind } from "../../core/chains/types";
import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getMarkets, type GetMarketsParameters, type GetMarketsReturnType } from "./get-markets";

/** Data resolved by the {@link getMarketsQueryOptions} query, generic over solver kind `K`. */
export type GetMarketsData<K extends SymmioSolverKind = SymmioSolverKind> = GetMarketsReturnType<K>;

/**
 * Build the TanStack Query key for {@link getMarketsQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, solver kind, scope).
 * @returns A stable, hashable query key.
 */
export function getMarketsQueryKey(options: Compute<GetMarketsParameters & ConfigKeyParameter> = {}) {
  return ["getMarkets", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getMarketsQueryKey}. */
export type GetMarketsQueryKey = ReturnType<typeof getMarketsQueryKey>;

/**
 * Options accepted by {@link getMarketsQueryOptions}: the action's parameters
 * (generic over solver kind `K`), an optional cache scope, and TanStack overrides.
 */
export type GetMarketsOptions<K extends SymmioSolverKind = SymmioSolverKind> = Compute<
  GetMarketsParameters<K> & QueryParameter<GetMarketsData<K>, Error, GetMarketsData<K>, GetMarketsQueryKey>
>;

/** TanStack Query options returned by {@link getMarketsQueryOptions}. */
export type GetMarketsQueryOptions<K extends SymmioSolverKind = SymmioSolverKind> = SymmioQueryOptions<
  GetMarketsData<K>,
  Error,
  GetMarketsData<K>,
  GetMarketsQueryKey
>;

/**
 * Build TanStack Query options for {@link getMarkets}. Generic over solver kind
 * `K`, so a literal `solverId` in `options` narrows the query's data type to
 * that solver's market type. An unsupported chain surfaces a {@link SymmError}
 * from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getMarketsQueryOptions(config, { solverId: "rasa" }));
 * ```
 */
export function getMarketsQueryOptions<K extends SymmioSolverKind = SymmioSolverKind>(
  config: Config,
  options: GetMarketsOptions<K> = {},
): GetMarketsQueryOptions<K> {
  return {
    ...options.query,
    queryKey: getMarketsQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getMarkets<K>(config, { chainId: options.chainId, solverId: options.solverId }),
  };
}
