import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getUserTransactions,
  type GetUserTransactionsParameters,
  type GetUserTransactionsReturnType,
} from "./get-user-transactions";

/** Data resolved by the {@link getUserTransactionsQueryOptions} query. */
export type GetUserTransactionsData = GetUserTransactionsReturnType;

/**
 * Build the TanStack Query key for {@link getUserTransactionsQueryOptions}.
 *
 * The bearer `accessToken` is dropped from the key by `filterQueryOptions` — it
 * is a credential, not a cache dimension, so a refreshed token still hits the
 * same cache entry and the token never leaks into a devtools-visible key.
 *
 * @param options - The action's parameters (including `accessToken`) plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getUserTransactionsQueryKey(options: Compute<GetUserTransactionsParameters & ConfigKeyParameter>) {
  return ["getUserTransactions", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getUserTransactionsQueryKey}. */
export type GetUserTransactionsQueryKey = ReturnType<typeof getUserTransactionsQueryKey>;

/**
 * Options accepted by {@link getUserTransactionsQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetUserTransactionsOptions = Compute<
  GetUserTransactionsParameters &
    QueryParameter<GetUserTransactionsData, Error, GetUserTransactionsData, GetUserTransactionsQueryKey>
>;

/** TanStack Query options returned by {@link getUserTransactionsQueryOptions}. */
export type GetUserTransactionsQueryOptions = SymmioQueryOptions<
  GetUserTransactionsData,
  Error,
  GetUserTransactionsData,
  GetUserTransactionsQueryKey
>;

/**
 * Build TanStack Query options for {@link getUserTransactions}.
 *
 * @param config - The SDK config.
 * @param options - The action's parameters (including the required `accessToken`) and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getUserTransactionsQueryOptions(config, { accessToken }));
 * ```
 */
export function getUserTransactionsQueryOptions(
  config: Config,
  options: GetUserTransactionsOptions,
): GetUserTransactionsQueryOptions {
  return {
    ...options.query,
    queryKey: getUserTransactionsQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getUserTransactions(config, {
        chainId: options.chainId,
        accessToken: options.accessToken,
        transactionType: options.transactionType,
        transactionStatus: options.transactionStatus,
        tokenAddress: options.tokenAddress,
        start: options.start,
        size: options.size,
      }),
  };
}
