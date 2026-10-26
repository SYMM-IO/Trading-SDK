import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getPoolStatistics,
  type GetPoolStatisticsParameters,
  type GetPoolStatisticsReturnType,
} from "./get-pool-statistics";
/** Stable key for the composed core read. Credentials are excluded. */
export function getPoolStatisticsQueryKey(options: Compute<GetPoolStatisticsParameters & ConfigKeyParameter>) {
  return ["getPoolStatistics", filterQueryOptions(options)] as const;
}
/** Composed query key type. */
export type GetPoolStatisticsQueryKey = ReturnType<typeof getPoolStatisticsQueryKey>;
/** Query controls plus all required read inputs. */
export type GetPoolStatisticsOptions = GetPoolStatisticsParameters &
  QueryParameter<GetPoolStatisticsReturnType, Error, GetPoolStatisticsReturnType, GetPoolStatisticsQueryKey>;
/** Build options for non-React consumers; React composition uses the underlying primitive queries instead.
 * @param config - SDK configuration.
 * @param options - Required read inputs and optional query controls.
 * @returns Typed query options with a credential-free key.
 */
export function getPoolStatisticsQueryOptions(
  config: Config,
  options: GetPoolStatisticsOptions,
): SymmioQueryOptions<GetPoolStatisticsReturnType, Error, GetPoolStatisticsReturnType, GetPoolStatisticsQueryKey> {
  return {
    ...options.query,
    queryKey: getPoolStatisticsQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled:
      (options.query?.enabled ?? true) &&
      (options.scope !== "user" || (options.accessToken.length > 0 && options.userAddress.length > 0)),
    queryFn: () => getPoolStatistics(config, options),
  };
}
