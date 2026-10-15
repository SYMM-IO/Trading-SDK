import type { Config } from "../../core/config";
import type { ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getNotionalCapSnapshot,
  type GetNotionalCapSnapshotParameters,
  type GetNotionalCapSnapshotReturnType,
} from "./get-notional-cap-snapshot";
/** Resolved data for getNotionalCapSnapshot. */
export type GetNotionalCapSnapshotData = GetNotionalCapSnapshotReturnType;
/** Deployment-scoped query identity. */
export function getNotionalCapSnapshotQueryKey(options: GetNotionalCapSnapshotParameters & ConfigKeyParameter = {}) {
  return ["getNotionalCapSnapshot", filterQueryOptions({ ...options })] as const;
}
/** Query identity type. */
export type GetNotionalCapSnapshotQueryKey = ReturnType<typeof getNotionalCapSnapshotQueryKey>;
/** Parameters and caller-owned cache policy. */
export type GetNotionalCapSnapshotOptions = GetNotionalCapSnapshotParameters &
  QueryParameter<GetNotionalCapSnapshotData, Error, GetNotionalCapSnapshotData, GetNotionalCapSnapshotQueryKey>;
/** Options for a TanStack query consumer. */
export function getNotionalCapSnapshotQueryOptions(
  config: Config,
  options: GetNotionalCapSnapshotOptions = {},
): SymmioQueryOptions<GetNotionalCapSnapshotData, Error, GetNotionalCapSnapshotData, GetNotionalCapSnapshotQueryKey> {
  return {
    ...options.query,
    queryKey: getNotionalCapSnapshotQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getNotionalCapSnapshot(config, options),
  };
}
