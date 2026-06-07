import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  simulateRequestCancelWithdraw,
  type SimulateRequestCancelWithdrawParameters,
  type SimulateRequestCancelWithdrawReturnType,
} from "../actions/simulate-request-cancel-withdraw";

/** Data resolved by the {@link getSimulateRequestCancelWithdrawQueryOptions} query. */
export type SimulateRequestCancelWithdrawData = SimulateRequestCancelWithdrawReturnType;

/**
 * Build the TanStack Query key for {@link getSimulateRequestCancelWithdrawQueryOptions}.
 *
 * @param options - Partial simulate parameters (chain id, account, requestId, from).
 * @returns A stable, hashable query key.
 */
export function getSimulateRequestCancelWithdrawQueryKey(
  options: Compute<ExactPartial<SimulateRequestCancelWithdrawParameters> & ConfigKeyParameter> = {},
) {
  return ["simulateRequestCancelWithdraw", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSimulateRequestCancelWithdrawQueryKey}. */
export type SimulateRequestCancelWithdrawQueryKey = ReturnType<typeof getSimulateRequestCancelWithdrawQueryKey>;

/** Options accepted by {@link getSimulateRequestCancelWithdrawQueryOptions}. */
export type SimulateRequestCancelWithdrawOptions = Compute<
  ExactPartial<SimulateRequestCancelWithdrawParameters> &
    QueryParameter<
      SimulateRequestCancelWithdrawData,
      Error,
      SimulateRequestCancelWithdrawData,
      SimulateRequestCancelWithdrawQueryKey
    >
>;

/** TanStack Query options returned by {@link getSimulateRequestCancelWithdrawQueryOptions}. */
export type SimulateRequestCancelWithdrawQueryOptions = SymmioQueryOptions<
  SimulateRequestCancelWithdrawData,
  Error,
  SimulateRequestCancelWithdrawData,
  SimulateRequestCancelWithdrawQueryKey
>;

/**
 * Build TanStack Query options that dry-run `requestCancelWithdraw`. The query is
 * disabled until `account` and `requestId` are set.
 *
 * @param config - The SDK config.
 * @param options - Simulate parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getSimulateRequestCancelWithdrawQueryOptions(
  config: Config,
  options: SimulateRequestCancelWithdrawOptions = {},
): SimulateRequestCancelWithdrawQueryOptions {
  return {
    ...options.query,
    queryKey: getSimulateRequestCancelWithdrawQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: Boolean(options.account) && options.requestId !== undefined && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, account, requestId, from } = options;
      if (!account || requestId === undefined) {
        throw new SymmError(
          "validation",
          "MISSING_ARGS",
          "simulateRequestCancelWithdraw: `account` and `requestId` are required.",
        );
      }
      return simulateRequestCancelWithdraw(config, { chainId, account, requestId, from });
    },
  };
}
