import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { hasEmptyListFilter } from "../../symmio-subgraph/subgraph-filters";
import {
  getFundingIndexCheckpoints,
  type GetFundingIndexCheckpointsParameters,
  type GetFundingIndexCheckpointsReturnType,
} from "./get-funding-index-checkpoints";

/** Data resolved by the {@link getFundingIndexCheckpointsQueryOptions} query. */
export type GetFundingIndexCheckpointsData = GetFundingIndexCheckpointsReturnType;

/**
 * Build the TanStack Query key for {@link getFundingIndexCheckpointsQueryOptions}.
 *
 * @param options - Query parameters (filters, paging, chain id, config key).
 * @returns A stable, hashable query key; `bigint` filters are stringified.
 */
export function getFundingIndexCheckpointsQueryKey(
  options: Compute<GetFundingIndexCheckpointsParameters & ConfigKeyParameter>,
) {
  return ["getFundingIndexCheckpoints", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getFundingIndexCheckpointsQueryKey}. */
export type GetFundingIndexCheckpointsQueryKey = ReturnType<typeof getFundingIndexCheckpointsQueryKey>;

/**
 * Options accepted by {@link getFundingIndexCheckpointsQueryOptions}: the action's parameters
 * plus TanStack overrides.
 */
export type GetFundingIndexCheckpointsOptions = Compute<
  GetFundingIndexCheckpointsParameters &
    QueryParameter<
      GetFundingIndexCheckpointsData,
      Error,
      GetFundingIndexCheckpointsData,
      GetFundingIndexCheckpointsQueryKey
    >
>;

/** TanStack Query options returned by {@link getFundingIndexCheckpointsQueryOptions}. */
export type GetFundingIndexCheckpointsQueryOptions = SymmioQueryOptions<
  GetFundingIndexCheckpointsData,
  Error,
  GetFundingIndexCheckpointsData,
  GetFundingIndexCheckpointsQueryKey
>;

/**
 * Build TanStack Query options for {@link getFundingIndexCheckpoints}. The query is disabled while
 * any list filter is an empty array (it would match nothing).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getFundingIndexCheckpointsQueryOptions(config, { marketIds: [42], partyBs: ["0xsolver…"] }));
 * ```
 */
export function getFundingIndexCheckpointsQueryOptions(
  config: Config,
  options: GetFundingIndexCheckpointsOptions = {},
): GetFundingIndexCheckpointsQueryOptions {
  const { query, ...parameters } = options;
  return {
    ...query,
    queryKey: getFundingIndexCheckpointsQueryKey({
      ...parameters,
      configKey: config.getChainConfigKey(parameters.chainId),
    }),
    enabled: (query?.enabled ?? true) && !hasEmptyListFilter(parameters.marketIds, parameters.partyBs),
    queryFn: () => getFundingIndexCheckpoints(config, parameters),
  };
}
