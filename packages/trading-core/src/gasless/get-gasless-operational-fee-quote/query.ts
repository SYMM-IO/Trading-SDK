import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getGaslessOperationalFeeQuote,
  type GetGaslessOperationalFeeQuoteParameters,
  type GetGaslessOperationalFeeQuoteReturnType,
} from "./get-gasless-operational-fee-quote";

/** Data resolved by the {@link getGaslessOperationalFeeQuoteQueryOptions} query. */
export type GetGaslessOperationalFeeQuoteData = GetGaslessOperationalFeeQuoteReturnType;

/**
 * Build the TanStack Query key for {@link getGaslessOperationalFeeQuoteQueryOptions}.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 */
export function getGaslessOperationalFeeQuoteQueryKey(
  options: Compute<ExactPartial<GetGaslessOperationalFeeQuoteParameters> & ConfigKeyParameter> = {},
) {
  return ["getGaslessOperationalFeeQuote", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getGaslessOperationalFeeQuoteQueryKey}. */
export type GetGaslessOperationalFeeQuoteQueryKey = ReturnType<typeof getGaslessOperationalFeeQuoteQueryKey>;

/**
 * Options accepted by {@link getGaslessOperationalFeeQuoteQueryOptions}.
 */
export type GetGaslessOperationalFeeQuoteOptions = Compute<
  GetGaslessOperationalFeeQuoteParameters &
    QueryParameter<
      GetGaslessOperationalFeeQuoteData,
      Error,
      GetGaslessOperationalFeeQuoteData,
      GetGaslessOperationalFeeQuoteQueryKey
    >
>;

/** TanStack Query options returned by {@link getGaslessOperationalFeeQuoteQueryOptions}. */
export type GetGaslessOperationalFeeQuoteQueryOptions = SymmioQueryOptions<
  GetGaslessOperationalFeeQuoteData,
  Error,
  GetGaslessOperationalFeeQuoteData,
  GetGaslessOperationalFeeQuoteQueryKey
>;

/**
 * Build TanStack Query options for {@link getGaslessOperationalFeeQuote}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getGaslessOperationalFeeQuoteQueryOptions(config, { account, operations }));
 * ```
 */
export function getGaslessOperationalFeeQuoteQueryOptions(
  config: Config,
  options: GetGaslessOperationalFeeQuoteOptions,
): GetGaslessOperationalFeeQuoteQueryOptions {
  return {
    ...options.query,
    queryKey: getGaslessOperationalFeeQuoteQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => {
      const { chainId, account, operations } = options;
      return getGaslessOperationalFeeQuote(config, { chainId, account, operations });
    },
  };
}
