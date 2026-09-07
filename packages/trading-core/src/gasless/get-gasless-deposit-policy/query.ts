import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getGaslessDepositPolicy,
  type GetGaslessDepositPolicyParameters,
  type GetGaslessDepositPolicyReturnType,
} from "./get-gasless-deposit-policy";

/** Data resolved by the {@link getGaslessDepositPolicyQueryOptions} query. */
export type GetGaslessDepositPolicyData = GetGaslessDepositPolicyReturnType;

/**
 * Build the TanStack Query key for {@link getGaslessDepositPolicyQueryOptions}.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 */
export function getGaslessDepositPolicyQueryKey(
  options: Compute<ExactPartial<GetGaslessDepositPolicyParameters> & ConfigKeyParameter> = {},
) {
  return ["getGaslessDepositPolicy", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getGaslessDepositPolicyQueryKey}. */
export type GetGaslessDepositPolicyQueryKey = ReturnType<typeof getGaslessDepositPolicyQueryKey>;

/**
 * Options accepted by {@link getGaslessDepositPolicyQueryOptions}.
 */
export type GetGaslessDepositPolicyOptions = Compute<
  GetGaslessDepositPolicyParameters &
    QueryParameter<GetGaslessDepositPolicyData, Error, GetGaslessDepositPolicyData, GetGaslessDepositPolicyQueryKey>
>;

/** TanStack Query options returned by {@link getGaslessDepositPolicyQueryOptions}. */
export type GetGaslessDepositPolicyQueryOptions = SymmioQueryOptions<
  GetGaslessDepositPolicyData,
  Error,
  GetGaslessDepositPolicyData,
  GetGaslessDepositPolicyQueryKey
>;

/**
 * Build TanStack Query options for {@link getGaslessDepositPolicy}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getGaslessDepositPolicyQueryOptions(config, { owner }));
 * ```
 */
export function getGaslessDepositPolicyQueryOptions(
  config: Config,
  options: GetGaslessDepositPolicyOptions,
): GetGaslessDepositPolicyQueryOptions {
  return {
    ...options.query,
    queryKey: getGaslessDepositPolicyQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => {
      const { chainId, owner } = options;
      return getGaslessDepositPolicy(config, { chainId, owner });
    },
  };
}
