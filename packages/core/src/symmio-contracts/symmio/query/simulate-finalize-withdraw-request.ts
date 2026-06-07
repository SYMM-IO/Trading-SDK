import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  simulateFinalizeWithdrawRequest,
  type SimulateFinalizeWithdrawRequestParameters,
  type SimulateFinalizeWithdrawRequestReturnType,
} from "../actions/simulate-finalize-withdraw-request";

/** Data resolved by the {@link getSimulateFinalizeWithdrawRequestQueryOptions} query. */
export type SimulateFinalizeWithdrawRequestData = SimulateFinalizeWithdrawRequestReturnType;

/**
 * Build the TanStack Query key for {@link getSimulateFinalizeWithdrawRequestQueryOptions}.
 *
 * @param options - Partial simulate parameters (chain id, user, requestId, from).
 * @returns A stable, hashable query key.
 */
export function getSimulateFinalizeWithdrawRequestQueryKey(
  options: Compute<ExactPartial<SimulateFinalizeWithdrawRequestParameters> & ConfigKeyParameter> = {},
) {
  return ["simulateFinalizeWithdrawRequest", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSimulateFinalizeWithdrawRequestQueryKey}. */
export type SimulateFinalizeWithdrawRequestQueryKey = ReturnType<typeof getSimulateFinalizeWithdrawRequestQueryKey>;

/** Options accepted by {@link getSimulateFinalizeWithdrawRequestQueryOptions}. */
export type SimulateFinalizeWithdrawRequestOptions = Compute<
  ExactPartial<SimulateFinalizeWithdrawRequestParameters> &
    QueryParameter<
      SimulateFinalizeWithdrawRequestData,
      Error,
      SimulateFinalizeWithdrawRequestData,
      SimulateFinalizeWithdrawRequestQueryKey
    >
>;

/** TanStack Query options returned by {@link getSimulateFinalizeWithdrawRequestQueryOptions}. */
export type SimulateFinalizeWithdrawRequestQueryOptions = SymmioQueryOptions<
  SimulateFinalizeWithdrawRequestData,
  Error,
  SimulateFinalizeWithdrawRequestData,
  SimulateFinalizeWithdrawRequestQueryKey
>;

/**
 * Build TanStack Query options that dry-run `finalizeWithdrawRequest`. The query
 * is disabled until `user` and `requestId` are set.
 *
 * @param config - The SDK config.
 * @param options - Simulate parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getSimulateFinalizeWithdrawRequestQueryOptions(
  config: Config,
  options: SimulateFinalizeWithdrawRequestOptions = {},
): SimulateFinalizeWithdrawRequestQueryOptions {
  return {
    ...options.query,
    queryKey: getSimulateFinalizeWithdrawRequestQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: Boolean(options.user) && options.requestId !== undefined && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, user, requestId, from } = options;
      if (!user || requestId === undefined) {
        throw new SymmError(
          "validation",
          "MISSING_ARGS",
          "simulateFinalizeWithdrawRequest: `user` and `requestId` are required.",
        );
      }
      return simulateFinalizeWithdrawRequest(config, { chainId, user, requestId, from });
    },
  };
}
