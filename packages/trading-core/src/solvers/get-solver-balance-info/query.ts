import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getSolverBalanceInfo,
  type GetSolverBalanceInfoParameters,
  type GetSolverBalanceInfoReturnType,
} from "./get-solver-balance-info";

/** Data resolved by the {@link getSolverBalanceInfoQueryOptions} query. */
export type GetSolverBalanceInfoData = GetSolverBalanceInfoReturnType;

/**
 * Build the TanStack Query key for {@link getSolverBalanceInfoQueryOptions}.
 *
 * @param options - Query parameters (address, chain id, scope).
 * @returns A stable, hashable query key.
 */
export function getSolverBalanceInfoQueryKey(options: Compute<GetSolverBalanceInfoParameters & ConfigKeyParameter>) {
  return ["getSolverBalanceInfo", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSolverBalanceInfoQueryKey}. */
export type GetSolverBalanceInfoQueryKey = ReturnType<typeof getSolverBalanceInfoQueryKey>;

/** Options accepted by {@link getSolverBalanceInfoQueryOptions}. */
export type GetSolverBalanceInfoOptions = Compute<
  GetSolverBalanceInfoParameters &
    QueryParameter<GetSolverBalanceInfoData, Error, GetSolverBalanceInfoData, GetSolverBalanceInfoQueryKey>
>;

/** TanStack Query options returned by {@link getSolverBalanceInfoQueryOptions}. */
export type GetSolverBalanceInfoQueryOptions = SymmioQueryOptions<
  GetSolverBalanceInfoData,
  Error,
  GetSolverBalanceInfoData,
  GetSolverBalanceInfoQueryKey
>;

/**
 * Build TanStack Query options for {@link getSolverBalanceInfo}. A non-rasa
 * solver surfaces `UNSUPPORTED_BY_SOLVER` from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getSolverBalanceInfoQueryOptions(
  config: Config,
  options: GetSolverBalanceInfoOptions,
): GetSolverBalanceInfoQueryOptions {
  return {
    ...options.query,
    queryKey: getSolverBalanceInfoQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getSolverBalanceInfo(config, {
        address: options.address,
        multiAccountAddress: options.multiAccountAddress,
        chainId: options.chainId,
        solverId: options.solverId,
      }),
  };
}
