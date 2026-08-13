import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { toQuoteIdKeyPart } from "../quote-id-key-part";
import { getQuoteFunding, type GetQuoteFundingParameters, type GetQuoteFundingReturnType } from "./get-quote-funding";

/** Data resolved by the {@link getQuoteFundingQueryOptions} query. */
export type GetQuoteFundingData = GetQuoteFundingReturnType;

/**
 * Build the TanStack Query key for {@link getQuoteFundingQueryOptions}.
 *
 * @param options - Query parameters (quote ids, chain id, config key).
 * @returns A stable, hashable query key. The `bigint` quote ids are stringified so
 *   the key is JSON-safe, and sorted so id order does not fragment the cache.
 */
export function getQuoteFundingQueryKey(options: Compute<GetQuoteFundingParameters & ConfigKeyParameter>) {
  const filtered = filterQueryOptions(options);
  return ["getQuoteFunding", { ...filtered, quoteIds: toQuoteIdKeyPart(options.quoteIds) }] as const;
}

/** Query-key type produced by {@link getQuoteFundingQueryKey}. */
export type GetQuoteFundingQueryKey = ReturnType<typeof getQuoteFundingQueryKey>;

/**
 * Options accepted by {@link getQuoteFundingQueryOptions}: the action's
 * parameters plus TanStack overrides.
 */
export type GetQuoteFundingOptions = Compute<
  GetQuoteFundingParameters & QueryParameter<GetQuoteFundingData, Error, GetQuoteFundingData, GetQuoteFundingQueryKey>
>;

/** TanStack Query options returned by {@link getQuoteFundingQueryOptions}. */
export type GetQuoteFundingQueryOptions = SymmioQueryOptions<
  GetQuoteFundingData,
  Error,
  GetQuoteFundingData,
  GetQuoteFundingQueryKey
>;

/**
 * Build TanStack Query options for {@link getQuoteFunding}. The query is
 * disabled until at least one `quoteId` is supplied.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getQuoteFundingQueryOptions(config, { quoteIds: [7334n] }),
 * );
 * ```
 */
export function getQuoteFundingQueryOptions(
  config: Config,
  options: GetQuoteFundingOptions,
): GetQuoteFundingQueryOptions {
  return {
    ...options.query,
    queryKey: getQuoteFundingQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: (options.query?.enabled ?? true) && options.quoteIds.length > 0,
    queryFn: () => getQuoteFunding(config, { chainId: options.chainId, quoteIds: options.quoteIds }),
  };
}
