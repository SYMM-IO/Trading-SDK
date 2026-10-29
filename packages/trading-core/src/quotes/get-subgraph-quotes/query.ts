import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { hasEmptyListFilter } from "../../symmio-subgraph/subgraph-filters";
import {
  getSubgraphQuotes,
  type GetSubgraphQuotesParameters,
  type GetSubgraphQuotesReturnType,
} from "./get-subgraph-quotes";

/** Data resolved by the {@link getSubgraphQuotesQueryOptions} query. */
export type GetSubgraphQuotesData = GetSubgraphQuotesReturnType;

/**
 * Build the TanStack Query key for {@link getSubgraphQuotesQueryOptions}.
 *
 * @param options - Query parameters (filters, paging, chain id, config key).
 * @returns A stable, hashable query key; `bigint` filters are stringified.
 */
export function getSubgraphQuotesQueryKey(options: Compute<GetSubgraphQuotesParameters & ConfigKeyParameter>) {
  return ["getSubgraphQuotes", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSubgraphQuotesQueryKey}. */
export type GetSubgraphQuotesQueryKey = ReturnType<typeof getSubgraphQuotesQueryKey>;

/**
 * Options accepted by {@link getSubgraphQuotesQueryOptions}: the action's parameters
 * plus TanStack overrides.
 */
export type GetSubgraphQuotesOptions = Compute<
  GetSubgraphQuotesParameters &
    QueryParameter<GetSubgraphQuotesData, Error, GetSubgraphQuotesData, GetSubgraphQuotesQueryKey>
>;

/** TanStack Query options returned by {@link getSubgraphQuotesQueryOptions}. */
export type GetSubgraphQuotesQueryOptions = SymmioQueryOptions<
  GetSubgraphQuotesData,
  Error,
  GetSubgraphQuotesData,
  GetSubgraphQuotesQueryKey
>;

/**
 * Build TanStack Query options for {@link getSubgraphQuotes}. The query is disabled while
 * any list filter is an empty array (it would match nothing).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getSubgraphQuotesQueryOptions(config, { quoteIds: [7334n], source: "0xdiamond…" }));
 * ```
 */
export function getSubgraphQuotesQueryOptions(
  config: Config,
  options: GetSubgraphQuotesOptions = {},
): GetSubgraphQuotesQueryOptions {
  const { query, ...parameters } = options;
  return {
    ...query,
    queryKey: getSubgraphQuotesQueryKey({
      ...parameters,
      configKey: config.getChainConfigKey(parameters.chainId),
    }),
    enabled: (query?.enabled ?? true) && !hasEmptyListFilter(parameters.quoteIds, parameters.partyAs),
    queryFn: () => getSubgraphQuotes(config, parameters),
  };
}
