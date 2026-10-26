import type { Config } from "../../core/config";
import type { ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getTimelockPolicy, type GetTimelockPolicyParameters, type TimelockPolicyReport } from "./get-timelock-policy";

/** Cache identity includes account, chain, provider metadata and solver selection. */
export function getTimelockPolicyQueryKey(options: Partial<GetTimelockPolicyParameters> & ConfigKeyParameter = {}) {
  return ["getTimelockPolicy", filterQueryOptions({ ...options })] as const;
}
/** Query key for a complete policy report. */
export type GetTimelockPolicyQueryKey = ReturnType<typeof getTimelockPolicyQueryKey>;
/** Required policy inputs plus standard TanStack query controls. */
export type GetTimelockPolicyOptions = GetTimelockPolicyParameters &
  QueryParameter<TimelockPolicyReport, Error, TimelockPolicyReport, GetTimelockPolicyQueryKey>;
/** Build query options without dropping the selected solver or provider. */
export function getTimelockPolicyQueryOptions(
  config: Config,
  options: GetTimelockPolicyOptions,
): SymmioQueryOptions<TimelockPolicyReport, Error, TimelockPolicyReport, GetTimelockPolicyQueryKey> {
  return {
    ...options.query,
    queryKey: getTimelockPolicyQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getTimelockPolicy(config, options),
  };
}
