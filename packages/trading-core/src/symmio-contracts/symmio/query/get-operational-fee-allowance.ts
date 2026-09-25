import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getOperationalFeeAllowance,
  type GetOperationalFeeAllowanceParameters,
  type GetOperationalFeeAllowanceReturnType,
} from "../actions/get-operational-fee-allowance";

/** Data resolved by the {@link getOperationalFeeAllowanceQueryOptions} query. */
export type GetOperationalFeeAllowanceData = GetOperationalFeeAllowanceReturnType;

/**
 * Build the TanStack Query key for {@link getOperationalFeeAllowanceQueryOptions}.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 */
export function getOperationalFeeAllowanceQueryKey(
  options: Compute<ExactPartial<GetOperationalFeeAllowanceParameters> & ConfigKeyParameter> = {},
) {
  return ["getOperationalFeeAllowance", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getOperationalFeeAllowanceQueryKey}. */
export type GetOperationalFeeAllowanceQueryKey = ReturnType<typeof getOperationalFeeAllowanceQueryKey>;

/**
 * Options accepted by {@link getOperationalFeeAllowanceQueryOptions}.
 */
export type GetOperationalFeeAllowanceOptions = Compute<
  GetOperationalFeeAllowanceParameters &
    QueryParameter<
      GetOperationalFeeAllowanceData,
      Error,
      GetOperationalFeeAllowanceData,
      GetOperationalFeeAllowanceQueryKey
    >
>;

/** TanStack Query options returned by {@link getOperationalFeeAllowanceQueryOptions}. */
export type GetOperationalFeeAllowanceQueryOptions = SymmioQueryOptions<
  GetOperationalFeeAllowanceData,
  Error,
  GetOperationalFeeAllowanceData,
  GetOperationalFeeAllowanceQueryKey
>;

/**
 * Build TanStack Query options for {@link getOperationalFeeAllowance}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getOperationalFeeAllowanceQueryOptions(config, { payer: subAccount }));
 * ```
 */
export function getOperationalFeeAllowanceQueryOptions(
  config: Config,
  options: GetOperationalFeeAllowanceOptions,
): GetOperationalFeeAllowanceQueryOptions {
  return {
    ...options.query,
    queryKey: getOperationalFeeAllowanceQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => {
      const { chainId, payer, charger } = options;
      return getOperationalFeeAllowance(config, { chainId, payer, charger });
    },
  };
}
