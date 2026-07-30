import type { SymmioSolverKind } from "../../core/chains/types";
import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import type { GetMarketInfoReturnType } from "./get-market-info";
import { getMarketInfo, type GetMarketInfoParameters } from "./get-market-info";

/** Data resolved by the {@link getMarketInfoQueryOptions} query, generic over solver kind `K`. */
export type GetMarketInfoData<K extends SymmioSolverKind = SymmioSolverKind> = GetMarketInfoReturnType<K>;

/** Build the TanStack Query key for {@link getMarketInfoQueryOptions}. */
export function getMarketInfoQueryKey(options: Compute<GetMarketInfoParameters & ConfigKeyParameter> = {}) {
  return ["getMarketInfo", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getMarketInfoQueryKey}. */
export type GetMarketInfoQueryKey = ReturnType<typeof getMarketInfoQueryKey>;

/** Options accepted by {@link getMarketInfoQueryOptions}, generic over solver kind `K`. */
export type GetMarketInfoOptions<K extends SymmioSolverKind = SymmioSolverKind> = Compute<
  GetMarketInfoParameters<K> & QueryParameter<GetMarketInfoData<K>, Error, GetMarketInfoData<K>, GetMarketInfoQueryKey>
>;

/** TanStack Query options returned by {@link getMarketInfoQueryOptions}. */
export type GetMarketInfoQueryOptions<K extends SymmioSolverKind = SymmioSolverKind> = SymmioQueryOptions<
  GetMarketInfoData<K>,
  Error,
  GetMarketInfoData<K>,
  GetMarketInfoQueryKey
>;

/**
 * Build TanStack Query options for {@link getMarketInfo}. Generic over solver
 * kind `K`, so a literal `solverId` narrows the query's data type.
 *
 * @param config - The SDK config.
 * @param options - Query parameters (optional `chainId`, `solverId`) and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getMarketInfoQueryOptions(config, {}));
 * ```
 */
export function getMarketInfoQueryOptions<K extends SymmioSolverKind = SymmioSolverKind>(
  config: Config,
  options: GetMarketInfoOptions<K> = {},
): GetMarketInfoQueryOptions<K> {
  return {
    ...options.query,
    queryKey: getMarketInfoQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getMarketInfo<K>(config, { chainId: options.chainId, solverId: options.solverId }),
  };
}
