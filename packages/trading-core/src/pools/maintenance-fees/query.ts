import type { Config } from "../../core/config";
import type { ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getPoolMaintenanceFees,
  type GetPoolMaintenanceFeesParameters,
  type GetPoolMaintenanceFeesReturnType,
} from "./get-pool-maintenance-fees";

/** Query options for {@link getPoolMaintenanceFees}. */
export type GetPoolMaintenanceFeesOptions = GetPoolMaintenanceFeesParameters &
  QueryParameter<GetPoolMaintenanceFeesReturnType>;
/** Stable cache identity, including deployment configuration. */
export function getPoolMaintenanceFeesQueryKey(options: GetPoolMaintenanceFeesParameters & ConfigKeyParameter) {
  return ["getPoolMaintenanceFees", filterQueryOptions({ ...options })] as const;
}
/** Build options for the listing read. Required identity/auth inputs gate execution. */
export function getPoolMaintenanceFeesQueryOptions(
  config: Config,
  options: GetPoolMaintenanceFeesOptions,
): SymmioQueryOptions<GetPoolMaintenanceFeesReturnType> {
  return {
    ...options.query,
    queryKey: getPoolMaintenanceFeesQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: (options.query?.enabled ?? true) && !!options.tokenContractAddress,
    queryFn: () => getPoolMaintenanceFees(config, options),
  };
}
