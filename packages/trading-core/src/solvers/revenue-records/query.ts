import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getRevenueRecords, type GetRevenueRecordsParameters } from "./get-revenue-records";
import type { GetRevenueRecordsReturnType } from "./types";

/** Data resolved by the {@link getRevenueRecordsQueryOptions} query. */
export type GetRevenueRecordsData = GetRevenueRecordsReturnType;

/** Build the TanStack Query key for {@link getRevenueRecordsQueryOptions}. */
export function getRevenueRecordsQueryKey(options: Compute<GetRevenueRecordsParameters & ConfigKeyParameter> = {}) {
  return ["getRevenueRecords", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getRevenueRecordsQueryKey}. */
export type GetRevenueRecordsQueryKey = ReturnType<typeof getRevenueRecordsQueryKey>;

/** Options accepted by {@link getRevenueRecordsQueryOptions}. */
export type GetRevenueRecordsOptions = Compute<
  GetRevenueRecordsParameters &
    QueryParameter<GetRevenueRecordsData, Error, GetRevenueRecordsData, GetRevenueRecordsQueryKey>
>;

/** TanStack Query options returned by {@link getRevenueRecordsQueryOptions}. */
export type GetRevenueRecordsQueryOptions = SymmioQueryOptions<
  GetRevenueRecordsData,
  Error,
  GetRevenueRecordsData,
  GetRevenueRecordsQueryKey
>;

/**
 * Build TanStack Query options for {@link getRevenueRecords}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters (optional `chainId`, cursor `id`, `symbolIds`, paging) and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getRevenueRecordsQueryOptions(config, { limit: 50 }));
 * ```
 */
export function getRevenueRecordsQueryOptions(
  config: Config,
  options: GetRevenueRecordsOptions = {},
): GetRevenueRecordsQueryOptions {
  return {
    ...options.query,
    queryKey: getRevenueRecordsQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getRevenueRecords(config, {
        chainId: options.chainId,
        solverId: options.solverId,
        id: options.id,
        symbolIds: options.symbolIds,
        offset: options.offset,
        limit: options.limit,
      }),
  };
}
