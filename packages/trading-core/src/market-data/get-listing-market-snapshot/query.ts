import type { Config } from "../../core/config";
import type { ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getListingMarketSnapshot,
  type GetListingMarketSnapshotParameters,
  type GetListingMarketSnapshotReturnType,
} from "./get-listing-market-snapshot";
/** Resolved data for getListingMarketSnapshot. */
export type GetListingMarketSnapshotData = GetListingMarketSnapshotReturnType;
/** Deployment-scoped query identity. */
export function getListingMarketSnapshotQueryKey(
  options: GetListingMarketSnapshotParameters & ConfigKeyParameter = {},
) {
  return ["getListingMarketSnapshot", filterQueryOptions({ ...options })] as const;
}
/** Query identity type. */
export type GetListingMarketSnapshotQueryKey = ReturnType<typeof getListingMarketSnapshotQueryKey>;
/** Parameters and caller-owned cache policy. */
export type GetListingMarketSnapshotOptions = GetListingMarketSnapshotParameters &
  QueryParameter<GetListingMarketSnapshotData, Error, GetListingMarketSnapshotData, GetListingMarketSnapshotQueryKey>;
/** Options for a TanStack query consumer. */
export function getListingMarketSnapshotQueryOptions(
  config: Config,
  options: GetListingMarketSnapshotOptions = {},
): SymmioQueryOptions<
  GetListingMarketSnapshotData,
  Error,
  GetListingMarketSnapshotData,
  GetListingMarketSnapshotQueryKey
> {
  return {
    ...options.query,
    queryKey: getListingMarketSnapshotQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getListingMarketSnapshot(config, options),
  };
}
