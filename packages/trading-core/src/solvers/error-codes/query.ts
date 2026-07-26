import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getSolverErrorCodes,
  type GetSolverErrorCodesParameters,
  type GetSolverErrorCodesReturnType,
} from "./get-solver-error-codes";

/** Data resolved by the {@link getSolverErrorCodesQueryOptions} query. */
export type GetSolverErrorCodesData = GetSolverErrorCodesReturnType;

/**
 * Build the TanStack Query key for {@link getSolverErrorCodesQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, scope).
 * @returns A stable, hashable query key.
 */
export function getSolverErrorCodesQueryKey(options: Compute<GetSolverErrorCodesParameters & ConfigKeyParameter> = {}) {
  return ["getSolverErrorCodes", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSolverErrorCodesQueryKey}. */
export type GetSolverErrorCodesQueryKey = ReturnType<typeof getSolverErrorCodesQueryKey>;

/**
 * Options accepted by {@link getSolverErrorCodesQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetSolverErrorCodesOptions = Compute<
  GetSolverErrorCodesParameters &
    QueryParameter<GetSolverErrorCodesData, Error, GetSolverErrorCodesData, GetSolverErrorCodesQueryKey>
>;

/** TanStack Query options returned by {@link getSolverErrorCodesQueryOptions}. */
export type GetSolverErrorCodesQueryOptions = SymmioQueryOptions<
  GetSolverErrorCodesData,
  Error,
  GetSolverErrorCodesData,
  GetSolverErrorCodesQueryKey
>;

/**
 * Build TanStack Query options for {@link getSolverErrorCodes}. The map is
 * effectively static, so this defaults to `staleTime: Infinity`; pass
 * `query.staleTime` to override. An unsupported chain surfaces a
 * {@link SymmError} from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getSolverErrorCodesQueryOptions(config, { chainId }));
 * ```
 */
export function getSolverErrorCodesQueryOptions(
  config: Config,
  options: GetSolverErrorCodesOptions = {},
): GetSolverErrorCodesQueryOptions {
  return {
    staleTime: Infinity,
    ...options.query,
    queryKey: getSolverErrorCodesQueryKey({
      ...options,
      configKey: config.getSolverKey({ chainId: options.chainId, solverId: options.solverId }),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getSolverErrorCodes(config, { chainId: options.chainId, solverId: options.solverId }),
  };
}
