import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getBinanceHealth,
  type GetBinanceHealthParameters,
  type GetBinanceHealthReturnType,
} from "./get-binance-health";

/** Data resolved by the {@link getBinanceHealthQueryOptions} query. */
export type GetBinanceHealthData = GetBinanceHealthReturnType;

/** Build the TanStack Query key for {@link getBinanceHealthQueryOptions}. */
export function getBinanceHealthQueryKey(options: Compute<GetBinanceHealthParameters & ConfigKeyParameter> = {}) {
  return ["getBinanceHealth", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getBinanceHealthQueryKey}. */
export type GetBinanceHealthQueryKey = ReturnType<typeof getBinanceHealthQueryKey>;

/** Options accepted by {@link getBinanceHealthQueryOptions}. */
export type GetBinanceHealthOptions = Compute<
  GetBinanceHealthParameters &
    QueryParameter<GetBinanceHealthData, Error, GetBinanceHealthData, GetBinanceHealthQueryKey>
>;

/** TanStack Query options returned by {@link getBinanceHealthQueryOptions}. */
export type GetBinanceHealthQueryOptions = SymmioQueryOptions<
  GetBinanceHealthData,
  Error,
  GetBinanceHealthData,
  GetBinanceHealthQueryKey
>;

/** Build TanStack Query options for {@link getBinanceHealth}. */
export function getBinanceHealthQueryOptions(
  config: Config,
  options: GetBinanceHealthOptions = {},
): GetBinanceHealthQueryOptions {
  return {
    ...options.query,
    queryKey: getBinanceHealthQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getBinanceHealth(config, { chainId: options.chainId, solverId: options.solverId }),
  };
}
