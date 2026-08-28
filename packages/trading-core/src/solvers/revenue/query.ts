import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getSolverRevenue,
  type GetSolverRevenueParameters,
  type GetSolverRevenueReturnType,
} from "./get-solver-revenue";

/** Data resolved by the {@link getSolverRevenueQueryOptions} query. */
export type GetSolverRevenueData = GetSolverRevenueReturnType;

/**
 * Build the TanStack Query key for {@link getSolverRevenueQueryOptions}.
 *
 * @param options - Query parameters plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getSolverRevenueQueryKey(options: Compute<GetSolverRevenueParameters & ConfigKeyParameter>) {
  return ["getSolverRevenue", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSolverRevenueQueryKey}. */
export type GetSolverRevenueQueryKey = ReturnType<typeof getSolverRevenueQueryKey>;

/**
 * Options accepted by {@link getSolverRevenueQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetSolverRevenueOptions = Compute<
  GetSolverRevenueParameters &
    QueryParameter<GetSolverRevenueData, Error, GetSolverRevenueData, GetSolverRevenueQueryKey>
>;

/** TanStack Query options returned by {@link getSolverRevenueQueryOptions}. */
export type GetSolverRevenueQueryOptions = SymmioQueryOptions<
  GetSolverRevenueData,
  Error,
  GetSolverRevenueData,
  GetSolverRevenueQueryKey
>;

/**
 * Build TanStack Query options for {@link getSolverRevenue}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getSolverRevenueQueryOptions(config, { timeRange: "24h" }));
 * ```
 */
export function getSolverRevenueQueryOptions(
  config: Config,
  options: GetSolverRevenueOptions = {},
): GetSolverRevenueQueryOptions {
  return {
    ...options.query,
    queryKey: getSolverRevenueQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getSolverRevenue(config, {
        chainId: options.chainId,
        solverId: options.solverId,
        symbolId: options.symbolId,
        timeRange: options.timeRange,
      }),
  };
}
