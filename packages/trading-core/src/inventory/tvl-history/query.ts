import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getInventoryTvlHistory,
  type GetInventoryTvlHistoryParameters,
  type GetInventoryTvlHistoryReturnType,
} from "./get-inventory-tvl-history";

/** Data resolved by the {@link getInventoryTvlHistoryQueryOptions} query. */
export type GetInventoryTvlHistoryData = GetInventoryTvlHistoryReturnType;

/**
 * Build the TanStack Query key for {@link getInventoryTvlHistoryQueryOptions}.
 *
 * @param options - Query parameters plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getInventoryTvlHistoryQueryKey(
  options: Compute<GetInventoryTvlHistoryParameters & ConfigKeyParameter>,
) {
  return ["getInventoryTvlHistory", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getInventoryTvlHistoryQueryKey}. */
export type GetInventoryTvlHistoryQueryKey = ReturnType<typeof getInventoryTvlHistoryQueryKey>;

/**
 * Options accepted by {@link getInventoryTvlHistoryQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetInventoryTvlHistoryOptions = Compute<
  GetInventoryTvlHistoryParameters &
    QueryParameter<GetInventoryTvlHistoryData, Error, GetInventoryTvlHistoryData, GetInventoryTvlHistoryQueryKey>
>;

/** TanStack Query options returned by {@link getInventoryTvlHistoryQueryOptions}. */
export type GetInventoryTvlHistoryQueryOptions = SymmioQueryOptions<
  GetInventoryTvlHistoryData,
  Error,
  GetInventoryTvlHistoryData,
  GetInventoryTvlHistoryQueryKey
>;

/**
 * Build TanStack Query options for {@link getInventoryTvlHistory}.
 *
 * @param config - The SDK config.
 * @param options - The action's parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getInventoryTvlHistoryQueryOptions(config, { symbolAddress: "0x1234…" }));
 * ```
 */
export function getInventoryTvlHistoryQueryOptions(
  config: Config,
  options: GetInventoryTvlHistoryOptions,
): GetInventoryTvlHistoryQueryOptions {
  return {
    ...options.query,
    queryKey: getInventoryTvlHistoryQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getInventoryTvlHistory(config, {
        chainId: options.chainId,
        symbolAddress: options.symbolAddress,
      }),
  };
}
