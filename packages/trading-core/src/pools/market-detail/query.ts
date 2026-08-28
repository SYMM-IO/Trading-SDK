import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getListingMarketDetail,
  type GetListingMarketDetailParameters,
  type GetListingMarketDetailReturnType,
} from "./get-listing-market-detail";

/** Data resolved by the {@link getListingMarketDetailQueryOptions} query. */
export type GetListingMarketDetailData = GetListingMarketDetailReturnType;

/**
 * Build the TanStack Query key for {@link getListingMarketDetailQueryOptions}.
 *
 * @param options - Query parameters plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getListingMarketDetailQueryKey(
  options: Compute<GetListingMarketDetailParameters & ConfigKeyParameter>,
) {
  return ["getListingMarketDetail", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getListingMarketDetailQueryKey}. */
export type GetListingMarketDetailQueryKey = ReturnType<typeof getListingMarketDetailQueryKey>;

/**
 * Options accepted by {@link getListingMarketDetailQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetListingMarketDetailOptions = Compute<
  GetListingMarketDetailParameters &
    QueryParameter<GetListingMarketDetailData, Error, GetListingMarketDetailData, GetListingMarketDetailQueryKey>
>;

/** TanStack Query options returned by {@link getListingMarketDetailQueryOptions}. */
export type GetListingMarketDetailQueryOptions = SymmioQueryOptions<
  GetListingMarketDetailData,
  Error,
  GetListingMarketDetailData,
  GetListingMarketDetailQueryKey
>;

/**
 * Build TanStack Query options for {@link getListingMarketDetail}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getListingMarketDetailQueryOptions(
  config: Config,
  options: GetListingMarketDetailOptions,
): GetListingMarketDetailQueryOptions {
  return {
    ...options.query,
    queryKey: getListingMarketDetailQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getListingMarketDetail(config, {
        chainId: options.chainId,
        tokenContractAddress: options.tokenContractAddress,
        depositChain: options.depositChain,
      }),
  };
}
