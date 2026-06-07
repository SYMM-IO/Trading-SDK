import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  simulateInitiateWithdraw,
  type SimulateInitiateWithdrawParameters,
  type SimulateInitiateWithdrawReturnType,
} from "../actions/simulate-initiate-withdraw";

/** Data resolved by the {@link getSimulateInitiateWithdrawQueryOptions} query. */
export type SimulateInitiateWithdrawData = SimulateInitiateWithdrawReturnType;

/**
 * Build the TanStack Query key for {@link getSimulateInitiateWithdrawQueryOptions}.
 *
 * @param options - Partial simulate parameters (chain id, account, parts, speedUp, providerData, from).
 * @returns A stable, hashable query key.
 */
export function getSimulateInitiateWithdrawQueryKey(
  options: Compute<ExactPartial<SimulateInitiateWithdrawParameters> & ConfigKeyParameter> = {},
) {
  return ["simulateInitiateWithdraw", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSimulateInitiateWithdrawQueryKey}. */
export type SimulateInitiateWithdrawQueryKey = ReturnType<typeof getSimulateInitiateWithdrawQueryKey>;

/** Options accepted by {@link getSimulateInitiateWithdrawQueryOptions}. */
export type SimulateInitiateWithdrawOptions = Compute<
  ExactPartial<SimulateInitiateWithdrawParameters> &
    QueryParameter<SimulateInitiateWithdrawData, Error, SimulateInitiateWithdrawData, SimulateInitiateWithdrawQueryKey>
>;

/** TanStack Query options returned by {@link getSimulateInitiateWithdrawQueryOptions}. */
export type SimulateInitiateWithdrawQueryOptions = SymmioQueryOptions<
  SimulateInitiateWithdrawData,
  Error,
  SimulateInitiateWithdrawData,
  SimulateInitiateWithdrawQueryKey
>;

/**
 * Build TanStack Query options that dry-run `initiateWithdraw`. The query is
 * disabled until `account` and a non-empty `parts` are set.
 *
 * @param config - The SDK config.
 * @param options - Simulate parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getSimulateInitiateWithdrawQueryOptions(
  config: Config,
  options: SimulateInitiateWithdrawOptions = {},
): SimulateInitiateWithdrawQueryOptions {
  return {
    ...options.query,
    queryKey: getSimulateInitiateWithdrawQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: Boolean(options.account) && (options.parts?.length ?? 0) > 0 && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, account, parts, speedUp, providerData, from } = options;
      if (!account || !parts?.length) {
        throw new SymmError(
          "validation",
          "MISSING_ARGS",
          "simulateInitiateWithdraw: `account` and a non-empty `parts` are required.",
        );
      }
      return simulateInitiateWithdraw(config, { chainId, account, parts, speedUp, providerData, from });
    },
  };
}
