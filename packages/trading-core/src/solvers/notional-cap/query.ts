import type { SymmioSolverKind } from "../../core/chains/types";
import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getNotionalCapBySymbolId,
  type GetNotionalCapBySymbolIdParameters,
  type GetNotionalCapBySymbolIdReturnType,
} from "./get-notional-cap-by-symbol-id";

/** Data resolved by the {@link getNotionalCapBySymbolIdQueryOptions} query, generic over solver kind `K`. */
export type GetNotionalCapBySymbolIdData<K extends SymmioSolverKind = SymmioSolverKind> =
  GetNotionalCapBySymbolIdReturnType<K>;

/**
 * Build the TanStack Query key for {@link getNotionalCapBySymbolIdQueryOptions}.
 */
export function getNotionalCapBySymbolIdQueryKey(
  options: Compute<GetNotionalCapBySymbolIdParameters & ConfigKeyParameter>,
) {
  return ["getNotionalCapBySymbolId", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getNotionalCapBySymbolIdQueryKey}. */
export type GetNotionalCapBySymbolIdQueryKey = ReturnType<typeof getNotionalCapBySymbolIdQueryKey>;

/**
 * Options accepted by {@link getNotionalCapBySymbolIdQueryOptions}: the action's
 * parameters (generic over solver kind `K`) plus TanStack overrides.
 */
export type GetNotionalCapBySymbolIdOptions<K extends SymmioSolverKind = SymmioSolverKind> = Compute<
  GetNotionalCapBySymbolIdParameters<K> &
    QueryParameter<
      GetNotionalCapBySymbolIdData<K>,
      Error,
      GetNotionalCapBySymbolIdData<K>,
      GetNotionalCapBySymbolIdQueryKey
    >
>;

/** TanStack Query options returned by {@link getNotionalCapBySymbolIdQueryOptions}. */
export type GetNotionalCapBySymbolIdQueryOptions<K extends SymmioSolverKind = SymmioSolverKind> = SymmioQueryOptions<
  GetNotionalCapBySymbolIdData<K>,
  Error,
  GetNotionalCapBySymbolIdData<K>,
  GetNotionalCapBySymbolIdQueryKey
>;

/**
 * Build TanStack Query options for {@link getNotionalCapBySymbolId}. Generic over
 * solver kind `K`, so a literal `solverId` narrows the query's data type. The
 * query is disabled when `symbolId` is `0` (the sentinel for "no market selected").
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getNotionalCapBySymbolIdQueryOptions(config, { symbolId: 132 }));
 * ```
 */
export function getNotionalCapBySymbolIdQueryOptions<K extends SymmioSolverKind = SymmioSolverKind>(
  config: Config,
  options: GetNotionalCapBySymbolIdOptions<K>,
): GetNotionalCapBySymbolIdQueryOptions<K> {
  return {
    ...options.query,
    queryKey: getNotionalCapBySymbolIdQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: (options.query?.enabled ?? true) && options.symbolId > 0,
    queryFn: () =>
      getNotionalCapBySymbolId<K>(config, {
        chainId: options.chainId,
        solverId: options.solverId,
        symbolId: options.symbolId,
      }),
  };
}
