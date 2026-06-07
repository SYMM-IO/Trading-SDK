import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  simulateEditAccountName,
  type SimulateEditAccountNameParameters,
  type SimulateEditAccountNameReturnType,
} from "../actions/simulate-edit-account-name";

/** Data resolved by the {@link getSimulateEditAccountNameQueryOptions} query. */
export type SimulateEditAccountNameData = SimulateEditAccountNameReturnType;

/**
 * Build the TanStack Query key for {@link getSimulateEditAccountNameQueryOptions}.
 *
 * @param options - Partial simulate parameters (chain id, account, name, from).
 * @returns A stable, hashable query key.
 */
export function getSimulateEditAccountNameQueryKey(
  options: Compute<ExactPartial<SimulateEditAccountNameParameters> & ConfigKeyParameter> = {},
) {
  return ["simulateEditAccountName", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSimulateEditAccountNameQueryKey}. */
export type SimulateEditAccountNameQueryKey = ReturnType<typeof getSimulateEditAccountNameQueryKey>;

/** Options accepted by {@link getSimulateEditAccountNameQueryOptions}. */
export type SimulateEditAccountNameOptions = Compute<
  ExactPartial<SimulateEditAccountNameParameters> &
    QueryParameter<SimulateEditAccountNameData, Error, SimulateEditAccountNameData, SimulateEditAccountNameQueryKey>
>;

/** TanStack Query options returned by {@link getSimulateEditAccountNameQueryOptions}. */
export type SimulateEditAccountNameQueryOptions = SymmioQueryOptions<
  SimulateEditAccountNameData,
  Error,
  SimulateEditAccountNameData,
  SimulateEditAccountNameQueryKey
>;

/**
 * Build TanStack Query options that dry-run `editAccountName`. The query is
 * disabled until `account` and a non-empty `name` are set.
 *
 * @param config - The SDK config.
 * @param options - Simulate parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getSimulateEditAccountNameQueryOptions(
  config: Config,
  options: SimulateEditAccountNameOptions = {},
): SimulateEditAccountNameQueryOptions {
  return {
    ...options.query,
    queryKey: getSimulateEditAccountNameQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: Boolean(options.account) && Boolean(options.name) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, account, name, from } = options;
      if (!account || !name) {
        throw new SymmError(
          "validation",
          "MISSING_ARGS",
          "simulateEditAccountName: `account` and `name` are required.",
        );
      }
      return simulateEditAccountName(config, { chainId, account, name, from });
    },
  };
}
