import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  simulateCreateSubAccounts,
  type SimulateCreateSubAccountsParameters,
  type SimulateCreateSubAccountsReturnType,
} from "../actions/simulate-create-sub-accounts";

/** Data resolved by the {@link getSimulateCreateSubAccountsQueryOptions} query. */
export type SimulateCreateSubAccountsData = SimulateCreateSubAccountsReturnType;

/**
 * Build the TanStack Query key for {@link getSimulateCreateSubAccountsQueryOptions}.
 *
 * @param options - Partial simulate parameters (chain id, affiliate, accountsData, from).
 * @returns A stable, hashable query key.
 */
export function getSimulateCreateSubAccountsQueryKey(
  options: Compute<ExactPartial<SimulateCreateSubAccountsParameters> & ConfigKeyParameter> = {},
) {
  return ["simulateCreateSubAccounts", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSimulateCreateSubAccountsQueryKey}. */
export type SimulateCreateSubAccountsQueryKey = ReturnType<typeof getSimulateCreateSubAccountsQueryKey>;

/** Options accepted by {@link getSimulateCreateSubAccountsQueryOptions}. */
export type SimulateCreateSubAccountsOptions = Compute<
  ExactPartial<SimulateCreateSubAccountsParameters> &
    QueryParameter<
      SimulateCreateSubAccountsData,
      Error,
      SimulateCreateSubAccountsData,
      SimulateCreateSubAccountsQueryKey
    >
>;

/** TanStack Query options returned by {@link getSimulateCreateSubAccountsQueryOptions}. */
export type SimulateCreateSubAccountsQueryOptions = SymmioQueryOptions<
  SimulateCreateSubAccountsData,
  Error,
  SimulateCreateSubAccountsData,
  SimulateCreateSubAccountsQueryKey
>;

/**
 * Build TanStack Query options that dry-run `createSubAccounts`. The query is
 * disabled until `affiliate` and a non-empty `accountsData` are set.
 *
 * @param config - The SDK config.
 * @param options - Simulate parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getSimulateCreateSubAccountsQueryOptions(config, { affiliate, accountsData, from }));
 * ```
 */
export function getSimulateCreateSubAccountsQueryOptions(
  config: Config,
  options: SimulateCreateSubAccountsOptions = {},
): SimulateCreateSubAccountsQueryOptions {
  return {
    ...options.query,
    queryKey: getSimulateCreateSubAccountsQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: Boolean(options.affiliate) && (options.accountsData?.length ?? 0) > 0 && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, affiliate, accountsData, from } = options;
      if (!affiliate || !accountsData?.length) {
        throw new SymmError(
          "validation",
          "MISSING_ARGS",
          "simulateCreateSubAccounts: `affiliate` and `accountsData` are required.",
        );
      }
      return simulateCreateSubAccounts(config, { chainId, affiliate, accountsData, from });
    },
  };
}
