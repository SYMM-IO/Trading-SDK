import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getSubAccountQuotes,
  type GetSubAccountQuotesParameters,
  type GetSubAccountQuotesReturnType,
} from "./get-sub-account-quotes";

/** Data resolved by the {@link getSubAccountQuotesQueryOptions} query. */
export type GetSubAccountQuotesData = GetSubAccountQuotesReturnType;

/**
 * Build the TanStack Query key for {@link getSubAccountQuotesQueryOptions}.
 *
 * @param options - Query parameters (chain id, subAccount, VA inclusion, extras, base url, config key).
 * @returns A stable, hashable query key.
 */
export function getSubAccountQuotesQueryKey(options: Compute<GetSubAccountQuotesParameters & ConfigKeyParameter>) {
  return ["getSubAccountQuotes", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSubAccountQuotesQueryKey}. */
export type GetSubAccountQuotesQueryKey = ReturnType<typeof getSubAccountQuotesQueryKey>;

/**
 * Options accepted by {@link getSubAccountQuotesQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetSubAccountQuotesOptions = Compute<
  GetSubAccountQuotesParameters &
    QueryParameter<GetSubAccountQuotesData, Error, GetSubAccountQuotesData, GetSubAccountQuotesQueryKey>
>;

/** TanStack Query options returned by {@link getSubAccountQuotesQueryOptions}. */
export type GetSubAccountQuotesQueryOptions = SymmioQueryOptions<
  GetSubAccountQuotesData,
  Error,
  GetSubAccountQuotesData,
  GetSubAccountQuotesQueryKey
>;

/**
 * Build TanStack Query options for {@link getSubAccountQuotes}. Pass
 * `query.refetchInterval` to poll; disable from the consumer via `query.enabled`
 * (e.g. until a valid `subAccount` is entered).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getSubAccountQuotesQueryOptions(config, {
 *     subAccount: "0xsub…",
 *     query: { refetchInterval: 5_000 },
 *   }),
 * );
 * ```
 */
export function getSubAccountQuotesQueryOptions(
  config: Config,
  options: GetSubAccountQuotesOptions,
): GetSubAccountQuotesQueryOptions {
  return {
    ...options.query,
    queryKey: getSubAccountQuotesQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getSubAccountQuotes(config, {
        chainId: options.chainId,
        subAccount: options.subAccount,
        includeVirtualAccounts: options.includeVirtualAccounts,
        extraAccounts: options.extraAccounts,
        baseUrl: options.baseUrl,
      }),
  };
}
