import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getNotionalCapBySymbolId,
  type GetNotionalCapBySymbolIdParameters,
  type GetNotionalCapBySymbolIdReturnType,
} from "./get-notional-cap-by-symbol-id";

/** Data resolved by the {@link getNotionalCapBySymbolIdQueryOptions} query. */
export type GetNotionalCapBySymbolIdData = GetNotionalCapBySymbolIdReturnType;

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
 * parameters plus TanStack overrides.
 */
export type GetNotionalCapBySymbolIdOptions = Compute<
  GetNotionalCapBySymbolIdParameters &
    QueryParameter<GetNotionalCapBySymbolIdData, Error, GetNotionalCapBySymbolIdData, GetNotionalCapBySymbolIdQueryKey>
>;

/** TanStack Query options returned by {@link getNotionalCapBySymbolIdQueryOptions}. */
export type GetNotionalCapBySymbolIdQueryOptions = SymmioQueryOptions<
  GetNotionalCapBySymbolIdData,
  Error,
  GetNotionalCapBySymbolIdData,
  GetNotionalCapBySymbolIdQueryKey
>;

/**
 * Build TanStack Query options for {@link getNotionalCapBySymbolId}. The query
 * is disabled when `symbolId` is `0` (the sentinel for "no market selected").
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
export function getNotionalCapBySymbolIdQueryOptions(
  config: Config,
  options: GetNotionalCapBySymbolIdOptions,
): GetNotionalCapBySymbolIdQueryOptions {
  return {
    ...options.query,
    queryKey: getNotionalCapBySymbolIdQueryKey({
      ...options,
      configKey: config.getSolverKey({ chainId: options.chainId, solverId: options.solverId }),
    }),
    enabled: (options.query?.enabled ?? true) && options.symbolId > 0,
    queryFn: () =>
      getNotionalCapBySymbolId(config, {
        chainId: options.chainId,
        solverId: options.solverId,
        symbolId: options.symbolId,
      }),
  };
}
