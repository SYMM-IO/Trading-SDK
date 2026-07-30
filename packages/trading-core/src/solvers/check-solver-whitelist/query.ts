import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  checkSolverWhitelist,
  type CheckSolverWhitelistParameters,
  type CheckSolverWhitelistReturnType,
} from "./check-solver-whitelist";

/** Data resolved by the {@link checkSolverWhitelistQueryOptions} query. */
export type CheckSolverWhitelistData = CheckSolverWhitelistReturnType;

/**
 * Build the TanStack Query key for {@link checkSolverWhitelistQueryOptions}.
 *
 * @param options - Query parameters (address, chain id, scope).
 * @returns A stable, hashable query key.
 */
export function checkSolverWhitelistQueryKey(options: Compute<CheckSolverWhitelistParameters & ConfigKeyParameter>) {
  return ["checkSolverWhitelist", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link checkSolverWhitelistQueryKey}. */
export type CheckSolverWhitelistQueryKey = ReturnType<typeof checkSolverWhitelistQueryKey>;

/** Options accepted by {@link checkSolverWhitelistQueryOptions}. */
export type CheckSolverWhitelistOptions = Compute<
  CheckSolverWhitelistParameters &
    QueryParameter<CheckSolverWhitelistData, Error, CheckSolverWhitelistData, CheckSolverWhitelistQueryKey>
>;

/** TanStack Query options returned by {@link checkSolverWhitelistQueryOptions}. */
export type CheckSolverWhitelistQueryOptions = SymmioQueryOptions<
  CheckSolverWhitelistData,
  Error,
  CheckSolverWhitelistData,
  CheckSolverWhitelistQueryKey
>;

/**
 * Build TanStack Query options for {@link checkSolverWhitelist}. A non-rasa
 * solver surfaces `UNSUPPORTED_BY_SOLVER` from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function checkSolverWhitelistQueryOptions(
  config: Config,
  options: CheckSolverWhitelistOptions,
): CheckSolverWhitelistQueryOptions {
  return {
    ...options.query,
    queryKey: checkSolverWhitelistQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      checkSolverWhitelist(config, {
        address: options.address,
        multiAccountAddress: options.multiAccountAddress,
        chainId: options.chainId,
        solverId: options.solverId,
      }),
  };
}
