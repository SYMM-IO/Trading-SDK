import type { Config } from "../../core/config";
import type { ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getEnigmaFundingInfo,
  type GetEnigmaFundingInfoParameters,
  type GetEnigmaFundingInfoReturnType,
} from "./get-enigma-funding-info";
/** Resolved data for getEnigmaFundingInfo. */
export type GetEnigmaFundingInfoData = GetEnigmaFundingInfoReturnType;
/** Deployment-scoped query identity. */
export function getEnigmaFundingInfoQueryKey(options: GetEnigmaFundingInfoParameters & ConfigKeyParameter = {}) {
  return ["getEnigmaFundingInfo", filterQueryOptions({ ...options })] as const;
}
/** Query identity type. */
export type GetEnigmaFundingInfoQueryKey = ReturnType<typeof getEnigmaFundingInfoQueryKey>;
/** Parameters and caller-owned cache policy. */
export type GetEnigmaFundingInfoOptions = GetEnigmaFundingInfoParameters &
  QueryParameter<GetEnigmaFundingInfoData, Error, GetEnigmaFundingInfoData, GetEnigmaFundingInfoQueryKey>;
/** Options for a TanStack query consumer. */
export function getEnigmaFundingInfoQueryOptions(
  config: Config,
  options: GetEnigmaFundingInfoOptions = {},
): SymmioQueryOptions<GetEnigmaFundingInfoData, Error, GetEnigmaFundingInfoData, GetEnigmaFundingInfoQueryKey> {
  return {
    ...options.query,
    queryKey: getEnigmaFundingInfoQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getEnigmaFundingInfo(config, options),
  };
}
