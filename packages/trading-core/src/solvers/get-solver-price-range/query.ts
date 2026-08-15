import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getSolverPriceRange,
  type GetSolverPriceRangeParameters,
  type GetSolverPriceRangeReturnType,
} from "./get-solver-price-range";

/** Data resolved by the {@link getSolverPriceRangeQueryOptions} query. */
export type GetSolverPriceRangeData = GetSolverPriceRangeReturnType;

/**
 * Build the TanStack Query key for {@link getSolverPriceRangeQueryOptions}.
 *
 * @param options - Query parameters (symbol, chain id, scope).
 * @returns A stable, hashable query key.
 */
export function getSolverPriceRangeQueryKey(options: Compute<GetSolverPriceRangeParameters & ConfigKeyParameter>) {
  return ["getSolverPriceRange", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSolverPriceRangeQueryKey}. */
export type GetSolverPriceRangeQueryKey = ReturnType<typeof getSolverPriceRangeQueryKey>;

/** Options accepted by {@link getSolverPriceRangeQueryOptions}. */
export type GetSolverPriceRangeOptions = Compute<
  GetSolverPriceRangeParameters &
    QueryParameter<GetSolverPriceRangeData, Error, GetSolverPriceRangeData, GetSolverPriceRangeQueryKey>
>;

/** TanStack Query options returned by {@link getSolverPriceRangeQueryOptions}. */
export type GetSolverPriceRangeQueryOptions = SymmioQueryOptions<
  GetSolverPriceRangeData,
  Error,
  GetSolverPriceRangeData,
  GetSolverPriceRangeQueryKey
>;

/**
 * Build TanStack Query options for {@link getSolverPriceRange}. A non-rasa
 * solver surfaces `UNSUPPORTED_BY_SOLVER` from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getSolverPriceRangeQueryOptions(
  config: Config,
  options: GetSolverPriceRangeOptions,
): GetSolverPriceRangeQueryOptions {
  return {
    ...options.query,
    queryKey: getSolverPriceRangeQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getSolverPriceRange(config, { symbol: options.symbol, chainId: options.chainId, solverId: options.solverId }),
  };
}
