import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { hasEmptyListFilter } from "../../symmio-subgraph/subgraph-filters";
import {
  getMarginTransfers,
  type GetMarginTransfersParameters,
  type GetMarginTransfersReturnType,
} from "./get-margin-transfers";

/** Data resolved by the {@link getMarginTransfersQueryOptions} query. */
export type GetMarginTransfersData = GetMarginTransfersReturnType;

/**
 * Build the TanStack Query key for {@link getMarginTransfersQueryOptions}.
 *
 * @param options - Query parameters (filters, paging, chain id, config key).
 * @returns A stable, hashable query key; `bigint` filters are stringified.
 */
export function getMarginTransfersQueryKey(options: Compute<GetMarginTransfersParameters & ConfigKeyParameter>) {
  return ["getMarginTransfers", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getMarginTransfersQueryKey}. */
export type GetMarginTransfersQueryKey = ReturnType<typeof getMarginTransfersQueryKey>;

/**
 * Options accepted by {@link getMarginTransfersQueryOptions}: the action's parameters
 * plus TanStack overrides.
 */
export type GetMarginTransfersOptions = Compute<
  GetMarginTransfersParameters &
    QueryParameter<GetMarginTransfersData, Error, GetMarginTransfersData, GetMarginTransfersQueryKey>
>;

/** TanStack Query options returned by {@link getMarginTransfersQueryOptions}. */
export type GetMarginTransfersQueryOptions = SymmioQueryOptions<
  GetMarginTransfersData,
  Error,
  GetMarginTransfersData,
  GetMarginTransfersQueryKey
>;

/**
 * Build TanStack Query options for {@link getMarginTransfers}. The query is disabled while
 * any list filter is an empty array (it would match nothing).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getMarginTransfersQueryOptions(config, { types: [MarginTransferType.Add], transactions: ["0xopen…"] }));
 * ```
 */
export function getMarginTransfersQueryOptions(
  config: Config,
  options: GetMarginTransfersOptions = {},
): GetMarginTransfersQueryOptions {
  const { query, ...parameters } = options;
  return {
    ...query,
    queryKey: getMarginTransfersQueryKey({
      ...parameters,
      configKey: config.getChainConfigKey(parameters.chainId),
    }),
    enabled:
      (query?.enabled ?? true) &&
      !hasEmptyListFilter(
        parameters.types,
        parameters.transactions,
        parameters.virtualAccounts,
        parameters.subAccounts,
      ),
    queryFn: () => getMarginTransfers(config, parameters),
  };
}
