import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getPoolOpenPositions,
  type GetPoolOpenPositionsParameters,
  type GetPoolOpenPositionsReturnType,
} from "./get-pool-open-positions";
/** Stable key for the composed core read. Credentials are excluded. */
export function getPoolOpenPositionsQueryKey(options: Compute<GetPoolOpenPositionsParameters & ConfigKeyParameter>) {
  return ["getPoolOpenPositions", filterQueryOptions(options)] as const;
}
/** Composed query key type. */
export type GetPoolOpenPositionsQueryKey = ReturnType<typeof getPoolOpenPositionsQueryKey>;
/** Query controls plus all required read inputs. */
export type GetPoolOpenPositionsOptions = GetPoolOpenPositionsParameters &
  QueryParameter<GetPoolOpenPositionsReturnType, Error, GetPoolOpenPositionsReturnType, GetPoolOpenPositionsQueryKey>;
/** Build options for non-React consumers; React composition uses the underlying primitive queries instead.
 * @param config - SDK configuration.
 * @param options - Required read inputs and optional query controls.
 * @returns Typed query options with a credential-free key.
 */
export function getPoolOpenPositionsQueryOptions(
  config: Config,
  options: GetPoolOpenPositionsOptions,
): SymmioQueryOptions<
  GetPoolOpenPositionsReturnType,
  Error,
  GetPoolOpenPositionsReturnType,
  GetPoolOpenPositionsQueryKey
> {
  return {
    ...options.query,
    queryKey: getPoolOpenPositionsQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getPoolOpenPositions(config, options),
  };
}
