import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { hasEmptyListFilter } from "../../symmio-subgraph/subgraph-filters";
import {
  getLiquidationDetails,
  type GetLiquidationDetailsParameters,
  type GetLiquidationDetailsReturnType,
} from "./get-liquidation-details";

/** Data resolved by the {@link getLiquidationDetailsQueryOptions} query. */
export type GetLiquidationDetailsData = GetLiquidationDetailsReturnType;

/**
 * Build the TanStack Query key for {@link getLiquidationDetailsQueryOptions}.
 *
 * @param options - Query parameters (filters, paging, chain id, config key).
 * @returns A stable, hashable query key; `bigint` filters are stringified.
 */
export function getLiquidationDetailsQueryKey(options: Compute<GetLiquidationDetailsParameters & ConfigKeyParameter>) {
  return ["getLiquidationDetails", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getLiquidationDetailsQueryKey}. */
export type GetLiquidationDetailsQueryKey = ReturnType<typeof getLiquidationDetailsQueryKey>;

/**
 * Options accepted by {@link getLiquidationDetailsQueryOptions}: the action's parameters
 * plus TanStack overrides.
 */
export type GetLiquidationDetailsOptions = Compute<
  GetLiquidationDetailsParameters &
    QueryParameter<GetLiquidationDetailsData, Error, GetLiquidationDetailsData, GetLiquidationDetailsQueryKey>
>;

/** TanStack Query options returned by {@link getLiquidationDetailsQueryOptions}. */
export type GetLiquidationDetailsQueryOptions = SymmioQueryOptions<
  GetLiquidationDetailsData,
  Error,
  GetLiquidationDetailsData,
  GetLiquidationDetailsQueryKey
>;

/**
 * Build TanStack Query options for {@link getLiquidationDetails}. The query is disabled while
 * any list filter is an empty array (it would match nothing).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getLiquidationDetailsQueryOptions(config, { source: "0xdiamond…", partyAs: ["0xvirtualAccount…"] }));
 * ```
 */
export function getLiquidationDetailsQueryOptions(
  config: Config,
  options: GetLiquidationDetailsOptions = {},
): GetLiquidationDetailsQueryOptions {
  const { query, ...parameters } = options;
  return {
    ...query,
    queryKey: getLiquidationDetailsQueryKey({
      ...parameters,
      configKey: config.getChainConfigKey(parameters.chainId),
    }),
    enabled: (query?.enabled ?? true) && !hasEmptyListFilter(parameters.partyAs),
    queryFn: () => getLiquidationDetails(config, parameters),
  };
}
