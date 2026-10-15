import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getSolverInfo, type GetSolverInfoParameters, type GetSolverInfoReturnType } from "./get-solver-info";

/** Data resolved by the {@link getSolverInfoQueryOptions} query. */
export type GetSolverInfoData = GetSolverInfoReturnType;

/**
 * Build the TanStack Query key for {@link getSolverInfoQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, solver).
 * @returns A stable, hashable query key.
 */
export function getSolverInfoQueryKey(options: Compute<GetSolverInfoParameters & ConfigKeyParameter> = {}) {
  return ["getSolverInfo", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSolverInfoQueryKey}. */
export type GetSolverInfoQueryKey = ReturnType<typeof getSolverInfoQueryKey>;

/** Options accepted by {@link getSolverInfoQueryOptions}. */
export type GetSolverInfoOptions = Compute<
  GetSolverInfoParameters & QueryParameter<GetSolverInfoData, Error, GetSolverInfoData, GetSolverInfoQueryKey>
>;

/** TanStack Query options returned by {@link getSolverInfoQueryOptions}. */
export type GetSolverInfoQueryOptions = SymmioQueryOptions<
  GetSolverInfoData,
  Error,
  GetSolverInfoData,
  GetSolverInfoQueryKey
>;

/**
 * Build TanStack Query options for {@link getSolverInfo}. A non-enigma solver
 * surfaces `UNSUPPORTED_BY_SOLVER` from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getSolverInfoQueryOptions(
  config: Config,
  options: GetSolverInfoOptions = {},
): GetSolverInfoQueryOptions {
  return {
    ...options.query,
    queryKey: getSolverInfoQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getSolverInfo(config, { chainId: options.chainId, solverId: options.solverId }),
  };
}
