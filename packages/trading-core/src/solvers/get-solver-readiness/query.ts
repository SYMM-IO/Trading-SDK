import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getSolverReadiness,
  type GetSolverReadinessParameters,
  type GetSolverReadinessReturnType,
} from "./get-solver-readiness";

/** Data resolved by the {@link getSolverReadinessQueryOptions} query. */
export type GetSolverReadinessData = GetSolverReadinessReturnType;

/**
 * Build the TanStack Query key for {@link getSolverReadinessQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, scope).
 * @returns A stable, hashable query key.
 */
export function getSolverReadinessQueryKey(options: Compute<GetSolverReadinessParameters & ConfigKeyParameter> = {}) {
  return ["getSolverReadiness", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSolverReadinessQueryKey}. */
export type GetSolverReadinessQueryKey = ReturnType<typeof getSolverReadinessQueryKey>;

/** Options accepted by {@link getSolverReadinessQueryOptions}. */
export type GetSolverReadinessOptions = Compute<
  GetSolverReadinessParameters &
    QueryParameter<GetSolverReadinessData, Error, GetSolverReadinessData, GetSolverReadinessQueryKey>
>;

/** TanStack Query options returned by {@link getSolverReadinessQueryOptions}. */
export type GetSolverReadinessQueryOptions = SymmioQueryOptions<
  GetSolverReadinessData,
  Error,
  GetSolverReadinessData,
  GetSolverReadinessQueryKey
>;

/**
 * Build TanStack Query options for {@link getSolverReadiness}. A non-rasa
 * solver surfaces `UNSUPPORTED_BY_SOLVER` from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getSolverReadinessQueryOptions(
  config: Config,
  options: GetSolverReadinessOptions = {},
): GetSolverReadinessQueryOptions {
  return {
    ...options.query,
    queryKey: getSolverReadinessQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getSolverReadiness(config, { chainId: options.chainId, solverId: options.solverId }),
  };
}
