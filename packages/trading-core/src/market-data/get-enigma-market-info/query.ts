import type { Config } from "../../core/config";
import type { ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getEnigmaMarketInfo,
  type GetEnigmaMarketInfoParameters,
  type GetEnigmaMarketInfoReturnType,
} from "./get-enigma-market-info";
/** Resolved data for getEnigmaMarketInfo. */
export type GetEnigmaMarketInfoData = GetEnigmaMarketInfoReturnType;
/** Deployment-scoped query identity. */
export function getEnigmaMarketInfoQueryKey(options: GetEnigmaMarketInfoParameters & ConfigKeyParameter = {}) {
  return ["getEnigmaMarketInfo", filterQueryOptions({ ...options })] as const;
}
/** Query identity type. */
export type GetEnigmaMarketInfoQueryKey = ReturnType<typeof getEnigmaMarketInfoQueryKey>;
/** Parameters and caller-owned cache policy. */
export type GetEnigmaMarketInfoOptions = GetEnigmaMarketInfoParameters &
  QueryParameter<GetEnigmaMarketInfoData, Error, GetEnigmaMarketInfoData, GetEnigmaMarketInfoQueryKey>;
/** Options for a TanStack query consumer. */
export function getEnigmaMarketInfoQueryOptions(
  config: Config,
  options: GetEnigmaMarketInfoOptions = {},
): SymmioQueryOptions<GetEnigmaMarketInfoData, Error, GetEnigmaMarketInfoData, GetEnigmaMarketInfoQueryKey> {
  return {
    ...options.query,
    queryKey: getEnigmaMarketInfoQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getEnigmaMarketInfo(config, options),
  };
}
