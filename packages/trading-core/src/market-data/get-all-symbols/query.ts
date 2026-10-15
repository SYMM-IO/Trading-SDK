import type { Config } from "../../core/config";
import type { ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getAllSymbols, type GetAllSymbolsParameters, type GetAllSymbolsReturnType } from "./get-all-symbols";
/** Resolved data for getAllSymbols. */
export type GetAllSymbolsData = GetAllSymbolsReturnType;
/** Deployment-scoped query identity. */
export function getAllSymbolsQueryKey(options: GetAllSymbolsParameters & ConfigKeyParameter = {}) {
  return ["getAllSymbols", filterQueryOptions({ ...options })] as const;
}
/** Query identity type. */
export type GetAllSymbolsQueryKey = ReturnType<typeof getAllSymbolsQueryKey>;
/** Parameters and caller-owned cache policy. */
export type GetAllSymbolsOptions = GetAllSymbolsParameters &
  QueryParameter<GetAllSymbolsData, Error, GetAllSymbolsData, GetAllSymbolsQueryKey>;
/** Options for a TanStack query consumer. */
export function getAllSymbolsQueryOptions(
  config: Config,
  options: GetAllSymbolsOptions = {},
): SymmioQueryOptions<GetAllSymbolsData, Error, GetAllSymbolsData, GetAllSymbolsQueryKey> {
  return {
    ...options.query,
    queryKey: getAllSymbolsQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getAllSymbols(config, options),
  };
}
