import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getPoolPosition, type GetPoolPositionParameters, type GetPoolPositionReturnType } from "./get-pool-position";
/** Stable key for the composed core read. Credentials are excluded. */
export function getPoolPositionQueryKey(options: Compute<GetPoolPositionParameters & ConfigKeyParameter>) {
  return ["getPoolPosition", filterQueryOptions(options)] as const;
}
/** Composed query key type. */
export type GetPoolPositionQueryKey = ReturnType<typeof getPoolPositionQueryKey>;
/** Query controls plus all required read inputs. */
export type GetPoolPositionOptions = GetPoolPositionParameters &
  QueryParameter<GetPoolPositionReturnType, Error, GetPoolPositionReturnType, GetPoolPositionQueryKey>;
/** Build options for non-React consumers; React composition uses the underlying primitive queries instead.
 * @param config - SDK configuration.
 * @param options - Required read inputs and optional query controls.
 * @returns Typed query options with a credential-free key.
 */
export function getPoolPositionQueryOptions(
  config: Config,
  options: GetPoolPositionOptions,
): SymmioQueryOptions<GetPoolPositionReturnType, Error, GetPoolPositionReturnType, GetPoolPositionQueryKey> {
  return {
    ...options.query,
    queryKey: getPoolPositionQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: (options.query?.enabled ?? true) && options.accessToken.length > 0 && options.userAddress.length > 0,
    queryFn: () => getPoolPosition(config, options),
  };
}
