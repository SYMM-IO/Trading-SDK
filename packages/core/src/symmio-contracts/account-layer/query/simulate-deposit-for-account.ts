import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  simulateDepositForAccount,
  type SimulateDepositForAccountParameters,
  type SimulateDepositForAccountReturnType,
} from "../actions/simulate-deposit-for-account";

/** Data resolved by the {@link getSimulateDepositForAccountQueryOptions} query. */
export type SimulateDepositForAccountData = SimulateDepositForAccountReturnType;

/**
 * Build the TanStack Query key for {@link getSimulateDepositForAccountQueryOptions}.
 *
 * @param options - Partial simulate parameters (chain id, account, amount, from).
 * @returns A stable, hashable query key.
 */
export function getSimulateDepositForAccountQueryKey(
  options: Compute<ExactPartial<SimulateDepositForAccountParameters> & ConfigKeyParameter> = {},
) {
  return ["simulateDepositForAccount", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSimulateDepositForAccountQueryKey}. */
export type SimulateDepositForAccountQueryKey = ReturnType<typeof getSimulateDepositForAccountQueryKey>;

/** Options accepted by {@link getSimulateDepositForAccountQueryOptions}. */
export type SimulateDepositForAccountOptions = Compute<
  ExactPartial<SimulateDepositForAccountParameters> &
    QueryParameter<
      SimulateDepositForAccountData,
      Error,
      SimulateDepositForAccountData,
      SimulateDepositForAccountQueryKey
    >
>;

/** TanStack Query options returned by {@link getSimulateDepositForAccountQueryOptions}. */
export type SimulateDepositForAccountQueryOptions = SymmioQueryOptions<
  SimulateDepositForAccountData,
  Error,
  SimulateDepositForAccountData,
  SimulateDepositForAccountQueryKey
>;

/**
 * Build TanStack Query options that dry-run `depositForAccount`. The query is
 * disabled until `account` and `amount` are set.
 *
 * @param config - The SDK config.
 * @param options - Simulate parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getSimulateDepositForAccountQueryOptions(
  config: Config,
  options: SimulateDepositForAccountOptions = {},
): SimulateDepositForAccountQueryOptions {
  return {
    ...options.query,
    queryKey: getSimulateDepositForAccountQueryKey({
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
          "simulateDepositForAccount: `account` and `amount` are required.",
        );
      }
      return simulateDepositForAccount(config, { chainId, account, amount, from });
    },
  };
}
