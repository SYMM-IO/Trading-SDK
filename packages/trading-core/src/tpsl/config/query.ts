import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getTpSlConfig, type GetTpSlConfigParameters, type GetTpSlConfigReturnType } from "./get-tpsl-config";

export type GetTpSlConfigData = GetTpSlConfigReturnType;

export function getTpSlConfigQueryKey(options: Compute<GetTpSlConfigParameters & ConfigKeyParameter>) {
  return ["getTpSlConfig", filterQueryOptions(options)] as const;
}

export type GetTpSlConfigQueryKey = ReturnType<typeof getTpSlConfigQueryKey>;

export type GetTpSlConfigOptions = Compute<
  GetTpSlConfigParameters & QueryParameter<GetTpSlConfigData, Error, GetTpSlConfigData, GetTpSlConfigQueryKey>
>;

export type GetTpSlConfigQueryOptions = SymmioQueryOptions<
  GetTpSlConfigData,
  Error,
  GetTpSlConfigData,
  GetTpSlConfigQueryKey
>;

/** Build TanStack Query options for {@link getTpSlConfig}. */
export function getTpSlConfigQueryOptions(
  config: Config,
  options: GetTpSlConfigOptions = {},
): GetTpSlConfigQueryOptions {
  return {
    ...options.query,
    queryKey: getTpSlConfigQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getTpSlConfig(config, { chainId: options.chainId }),
  };
}
