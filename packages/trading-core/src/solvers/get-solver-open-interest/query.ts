import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getSolverOpenInterest,
  type GetSolverOpenInterestParameters,
  type GetSolverOpenInterestReturnType,
} from "./get-solver-open-interest";

/** Data resolved by the {@link getSolverOpenInterestQueryOptions} query. */
export type GetSolverOpenInterestData = GetSolverOpenInterestReturnType;

/**
 * Build the TanStack Query key for {@link getSolverOpenInterestQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, scope).
 * @returns A stable, hashable query key.
 */
export function getSolverOpenInterestQueryKey(
  options: Compute<GetSolverOpenInterestParameters & ConfigKeyParameter> = {},
) {
  return ["getSolverOpenInterest", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSolverOpenInterestQueryKey}. */
export type GetSolverOpenInterestQueryKey = ReturnType<typeof getSolverOpenInterestQueryKey>;

/** Options accepted by {@link getSolverOpenInterestQueryOptions}. */
export type GetSolverOpenInterestOptions = Compute<
  GetSolverOpenInterestParameters &
    QueryParameter<GetSolverOpenInterestData, Error, GetSolverOpenInterestData, GetSolverOpenInterestQueryKey>
>;

/** TanStack Query options returned by {@link getSolverOpenInterestQueryOptions}. */
export type GetSolverOpenInterestQueryOptions = SymmioQueryOptions<
  GetSolverOpenInterestData,
  Error,
  GetSolverOpenInterestData,
  GetSolverOpenInterestQueryKey
>;

/**
 * Build TanStack Query options for {@link getSolverOpenInterest}. A non-rasa
 * solver surfaces `UNSUPPORTED_BY_SOLVER` from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getSolverOpenInterestQueryOptions(
  config: Config,
  options: GetSolverOpenInterestOptions = {},
): GetSolverOpenInterestQueryOptions {
  return {
    ...options.query,
    queryKey: getSolverOpenInterestQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getSolverOpenInterest(config, { chainId: options.chainId, solverId: options.solverId }),
  };
}
