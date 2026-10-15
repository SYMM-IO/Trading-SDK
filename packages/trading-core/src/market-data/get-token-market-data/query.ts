import type { Config } from "../../core/config";
import type { ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getTokenMarketData,
  type GetTokenMarketDataParameters,
  type GetTokenMarketDataReturnType,
} from "./get-token-market-data";
/** Resolved data for getTokenMarketData. */
export type GetTokenMarketDataData = GetTokenMarketDataReturnType;
/** Deployment-scoped query identity. */
export function getTokenMarketDataQueryKey(options: GetTokenMarketDataParameters & ConfigKeyParameter) {
  return ["getTokenMarketData", filterQueryOptions({ ...options })] as const;
}
/** Query identity type. */
export type GetTokenMarketDataQueryKey = ReturnType<typeof getTokenMarketDataQueryKey>;
/** Parameters and caller-owned cache policy. */
export type GetTokenMarketDataOptions = GetTokenMarketDataParameters &
  QueryParameter<GetTokenMarketDataData, Error, GetTokenMarketDataData, GetTokenMarketDataQueryKey>;
/** Options for a TanStack query consumer. */
export function getTokenMarketDataQueryOptions(
  config: Config,
  options: GetTokenMarketDataOptions,
): SymmioQueryOptions<GetTokenMarketDataData, Error, GetTokenMarketDataData, GetTokenMarketDataQueryKey> {
  return {
    ...options.query,
    queryKey: getTokenMarketDataQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getTokenMarketData(config, options),
  };
}
