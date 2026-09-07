import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getGaslessRequestTransactions,
  type GetGaslessRequestTransactionsParameters,
  type GetGaslessRequestTransactionsReturnType,
} from "./get-gasless-request-transactions";

/** Data resolved by the {@link getGaslessRequestTransactionsQueryOptions} query. */
export type GetGaslessRequestTransactionsData = GetGaslessRequestTransactionsReturnType;

/**
 * Build the TanStack Query key for {@link getGaslessRequestTransactionsQueryOptions}.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 */
export function getGaslessRequestTransactionsQueryKey(
  options: Compute<ExactPartial<GetGaslessRequestTransactionsParameters> & ConfigKeyParameter> = {},
) {
  return ["getGaslessRequestTransactions", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getGaslessRequestTransactionsQueryKey}. */
export type GetGaslessRequestTransactionsQueryKey = ReturnType<typeof getGaslessRequestTransactionsQueryKey>;

/**
 * Options accepted by {@link getGaslessRequestTransactionsQueryOptions}.
 */
export type GetGaslessRequestTransactionsOptions = Compute<
  GetGaslessRequestTransactionsParameters &
    QueryParameter<
      GetGaslessRequestTransactionsData,
      Error,
      GetGaslessRequestTransactionsData,
      GetGaslessRequestTransactionsQueryKey
    >
>;

/** TanStack Query options returned by {@link getGaslessRequestTransactionsQueryOptions}. */
export type GetGaslessRequestTransactionsQueryOptions = SymmioQueryOptions<
  GetGaslessRequestTransactionsData,
  Error,
  GetGaslessRequestTransactionsData,
  GetGaslessRequestTransactionsQueryKey
>;

/**
 * Build TanStack Query options for {@link getGaslessRequestTransactions}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getGaslessRequestTransactionsQueryOptions(config, { requestId }));
 * ```
 */
export function getGaslessRequestTransactionsQueryOptions(
  config: Config,
  options: GetGaslessRequestTransactionsOptions,
): GetGaslessRequestTransactionsQueryOptions {
  return {
    ...options.query,
    queryKey: getGaslessRequestTransactionsQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => {
      const { chainId, requestId, service } = options;
      return getGaslessRequestTransactions(config, { chainId, requestId, service });
    },
  };
}
