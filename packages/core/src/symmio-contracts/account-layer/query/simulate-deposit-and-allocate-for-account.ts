import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  simulateDepositAndAllocateForAccount,
  type SimulateDepositAndAllocateForAccountParameters,
  type SimulateDepositAndAllocateForAccountReturnType,
} from "../actions/simulate-deposit-and-allocate-for-account";

/** Data resolved by the {@link getSimulateDepositAndAllocateForAccountQueryOptions} query. */
export type SimulateDepositAndAllocateForAccountData = SimulateDepositAndAllocateForAccountReturnType;

/**
 * Build the TanStack Query key for
 * {@link getSimulateDepositAndAllocateForAccountQueryOptions}.
 *
 * @param options - Partial simulate parameters (chain id, account, amount, from).
 * @returns A stable, hashable query key.
 */
export function getSimulateDepositAndAllocateForAccountQueryKey(
  options: Compute<ExactPartial<SimulateDepositAndAllocateForAccountParameters> & ConfigKeyParameter> = {},
) {
  return ["simulateDepositAndAllocateForAccount", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSimulateDepositAndAllocateForAccountQueryKey}. */
export type SimulateDepositAndAllocateForAccountQueryKey = ReturnType<
  typeof getSimulateDepositAndAllocateForAccountQueryKey
>;

/** Options accepted by {@link getSimulateDepositAndAllocateForAccountQueryOptions}. */
export type SimulateDepositAndAllocateForAccountOptions = Compute<
  ExactPartial<SimulateDepositAndAllocateForAccountParameters> &
    QueryParameter<
      SimulateDepositAndAllocateForAccountData,
      Error,
      SimulateDepositAndAllocateForAccountData,
      SimulateDepositAndAllocateForAccountQueryKey
    >
>;

/** TanStack Query options returned by {@link getSimulateDepositAndAllocateForAccountQueryOptions}. */
export type SimulateDepositAndAllocateForAccountQueryOptions = SymmioQueryOptions<
  SimulateDepositAndAllocateForAccountData,
  Error,
  SimulateDepositAndAllocateForAccountData,
  SimulateDepositAndAllocateForAccountQueryKey
>;

/**
 * Build TanStack Query options that dry-run `depositAndAllocateForAccount`. The
 * query is disabled until `account` and `amount` are set.
 *
 * @param config - The SDK config.
 * @param options - Simulate parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getSimulateDepositAndAllocateForAccountQueryOptions(
  config: Config,
  options: SimulateDepositAndAllocateForAccountOptions = {},
): SimulateDepositAndAllocateForAccountQueryOptions {
  return {
    ...options.query,
    queryKey: getSimulateDepositAndAllocateForAccountQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: Boolean(options.account) && options.amount !== undefined && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, account, amount, from } = options;
      if (!account || amount === undefined) {
        throw new SymmError(
          "validation",
          "MISSING_ARGS",
          "simulateDepositAndAllocateForAccount: `account` and `amount` are required.",
        );
      }
      return simulateDepositAndAllocateForAccount(config, { chainId, account, amount, from });
    },
  };
}
