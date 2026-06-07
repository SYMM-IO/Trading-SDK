import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  simulateGrantDelegation,
  type SimulateGrantDelegationParameters,
  type SimulateGrantDelegationReturnType,
} from "../actions/simulate-grant-delegation";

/** Data resolved by the {@link getSimulateGrantDelegationQueryOptions} query. */
export type SimulateGrantDelegationData = SimulateGrantDelegationReturnType;

/**
 * Build the TanStack Query key for {@link getSimulateGrantDelegationQueryOptions}.
 *
 * @param options - Partial simulate parameters (chain id, account, delegatedSigner, selectors, expiryTimestamp, from).
 * @returns A stable, hashable query key.
 */
export function getSimulateGrantDelegationQueryKey(
  options: Compute<ExactPartial<SimulateGrantDelegationParameters> & ConfigKeyParameter> = {},
) {
  return ["simulateGrantDelegation", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSimulateGrantDelegationQueryKey}. */
export type SimulateGrantDelegationQueryKey = ReturnType<typeof getSimulateGrantDelegationQueryKey>;

/** Options accepted by {@link getSimulateGrantDelegationQueryOptions}. */
export type SimulateGrantDelegationOptions = Compute<
  ExactPartial<SimulateGrantDelegationParameters> &
    QueryParameter<SimulateGrantDelegationData, Error, SimulateGrantDelegationData, SimulateGrantDelegationQueryKey>
>;

/** TanStack Query options returned by {@link getSimulateGrantDelegationQueryOptions}. */
export type SimulateGrantDelegationQueryOptions = SymmioQueryOptions<
  SimulateGrantDelegationData,
  Error,
  SimulateGrantDelegationData,
  SimulateGrantDelegationQueryKey
>;

/**
 * Build TanStack Query options that dry-run `grantDelegation`. The query is
 * disabled until `account`, `delegatedSigner`, a non-empty `selectors`, and
 * `expiryTimestamp` are set.
 *
 * @param config - The SDK config.
 * @param options - Simulate parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getSimulateGrantDelegationQueryOptions(
  config: Config,
  options: SimulateGrantDelegationOptions = {},
): SimulateGrantDelegationQueryOptions {
  return {
    ...options.query,
    queryKey: getSimulateGrantDelegationQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled:
      Boolean(options.account) &&
      Boolean(options.delegatedSigner) &&
      (options.selectors?.length ?? 0) > 0 &&
      options.expiryTimestamp !== undefined &&
      (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, account, delegatedSigner, selectors, expiryTimestamp, from } = options;
      if (!account || !delegatedSigner || !selectors?.length || expiryTimestamp === undefined) {
        throw new SymmError(
          "validation",
          "MISSING_ARGS",
          "simulateGrantDelegation: `account`, `delegatedSigner`, `selectors`, and `expiryTimestamp` are required.",
        );
      }
      return simulateGrantDelegation(config, { chainId, account, delegatedSigner, selectors, expiryTimestamp, from });
    },
  };
}
