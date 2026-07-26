import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getMarketInfo, type GetMarketInfoParameters } from "./get-market-info";
import type { GetMarketInfoReturnType } from "./types";

/** Data resolved by the {@link getMarketInfoQueryOptions} query. */
export type GetMarketInfoData = GetMarketInfoReturnType;

/** Build the TanStack Query key for {@link getMarketInfoQueryOptions}. */
export function getMarketInfoQueryKey(options: Compute<GetMarketInfoParameters & ConfigKeyParameter> = {}) {
  return ["getMarketInfo", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getMarketInfoQueryKey}. */
export type GetMarketInfoQueryKey = ReturnType<typeof getMarketInfoQueryKey>;

/** Options accepted by {@link getMarketInfoQueryOptions}. */
export type GetMarketInfoOptions = Compute<
  GetMarketInfoParameters & QueryParameter<GetMarketInfoData, Error, GetMarketInfoData, GetMarketInfoQueryKey>
>;

/** TanStack Query options returned by {@link getMarketInfoQueryOptions}. */
export type GetMarketInfoQueryOptions = SymmioQueryOptions<
  GetMarketInfoData,
  Error,
  GetMarketInfoData,
  GetMarketInfoQueryKey
>;

/**
 * Build TanStack Query options for {@link getMarketInfo}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters (optional `chainId`) and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getMarketInfoQueryOptions(config, {}));
 * ```
 */
export function getMarketInfoQueryOptions(
  config: Config,
  options: GetMarketInfoOptions = {},
): GetMarketInfoQueryOptions {
  return {
    ...options.query,
    queryKey: getMarketInfoQueryKey({
      ...options,
      configKey: config.getSolverKey({ chainId: options.chainId, solverId: options.solverId }),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getMarketInfo(config, { chainId: options.chainId, solverId: options.solverId }),
  };
}
