import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { hasEmptyListFilter } from "../../symmio-subgraph/subgraph-filters";
import {
  getQuoteFundingSettlements,
  type GetQuoteFundingSettlementsParameters,
  type GetQuoteFundingSettlementsReturnType,
} from "./get-quote-funding-settlements";

/** Data resolved by the {@link getQuoteFundingSettlementsQueryOptions} query. */
export type GetQuoteFundingSettlementsData = GetQuoteFundingSettlementsReturnType;

/**
 * Build the TanStack Query key for {@link getQuoteFundingSettlementsQueryOptions}.
 *
 * @param options - Query parameters (filters, paging, chain id, config key).
 * @returns A stable, hashable query key; `bigint` filters are stringified.
 */
export function getQuoteFundingSettlementsQueryKey(
  options: Compute<GetQuoteFundingSettlementsParameters & ConfigKeyParameter>,
) {
  return ["getQuoteFundingSettlements", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getQuoteFundingSettlementsQueryKey}. */
export type GetQuoteFundingSettlementsQueryKey = ReturnType<typeof getQuoteFundingSettlementsQueryKey>;

/**
 * Options accepted by {@link getQuoteFundingSettlementsQueryOptions}: the action's parameters
 * plus TanStack overrides.
 */
export type GetQuoteFundingSettlementsOptions = Compute<
  GetQuoteFundingSettlementsParameters &
    QueryParameter<
      GetQuoteFundingSettlementsData,
      Error,
      GetQuoteFundingSettlementsData,
      GetQuoteFundingSettlementsQueryKey
    >
>;

/** TanStack Query options returned by {@link getQuoteFundingSettlementsQueryOptions}. */
export type GetQuoteFundingSettlementsQueryOptions = SymmioQueryOptions<
  GetQuoteFundingSettlementsData,
  Error,
  GetQuoteFundingSettlementsData,
  GetQuoteFundingSettlementsQueryKey
>;

/**
 * Build TanStack Query options for {@link getQuoteFundingSettlements}. The query is disabled while
 * any list filter is an empty array (it would match nothing).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getQuoteFundingSettlementsQueryOptions(config, { quoteIds: [7334n] }));
 * ```
 */
export function getQuoteFundingSettlementsQueryOptions(
  config: Config,
  options: GetQuoteFundingSettlementsOptions = {},
): GetQuoteFundingSettlementsQueryOptions {
  const { query, ...parameters } = options;
  return {
    ...query,
    queryKey: getQuoteFundingSettlementsQueryKey({
      ...parameters,
      configKey: config.getChainConfigKey(parameters.chainId),
    }),
    enabled: (query?.enabled ?? true) && !hasEmptyListFilter(parameters.quoteIds, parameters.partyAs),
    queryFn: () => getQuoteFundingSettlements(config, parameters),
  };
}
