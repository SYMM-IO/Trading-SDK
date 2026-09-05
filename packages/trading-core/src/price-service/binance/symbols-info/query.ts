import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getBinanceSymbolsInfo,
  type GetBinanceSymbolsInfoParameters,
  type GetBinanceSymbolsInfoReturnType,
} from "./get-binance-symbols-info";

/**
 * Default cache lifetime for the listing.
 *
 * The payload is ~1 MB and the listing changes on the order of days, so the
 * default leans hard on the cache. Override per call if you need it fresher.
 */
const SYMBOLS_INFO_STALE_TIME_MS = 60 * 60 * 1000;

/** Data resolved by the {@link getBinanceSymbolsInfoQueryOptions} query. */
export type GetBinanceSymbolsInfoData = GetBinanceSymbolsInfoReturnType;

/** Build the TanStack Query key for {@link getBinanceSymbolsInfoQueryOptions}. */
export function getBinanceSymbolsInfoQueryKey(
  options: Compute<GetBinanceSymbolsInfoParameters & ConfigKeyParameter> = {},
) {
  return ["getBinanceSymbolsInfo", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getBinanceSymbolsInfoQueryKey}. */
export type GetBinanceSymbolsInfoQueryKey = ReturnType<typeof getBinanceSymbolsInfoQueryKey>;

/** Options accepted by {@link getBinanceSymbolsInfoQueryOptions}. */
export type GetBinanceSymbolsInfoOptions = Compute<
  GetBinanceSymbolsInfoParameters &
    QueryParameter<GetBinanceSymbolsInfoData, Error, GetBinanceSymbolsInfoData, GetBinanceSymbolsInfoQueryKey>
>;

/** TanStack Query options returned by {@link getBinanceSymbolsInfoQueryOptions}. */
export type GetBinanceSymbolsInfoQueryOptions = SymmioQueryOptions<
  GetBinanceSymbolsInfoData,
  Error,
  GetBinanceSymbolsInfoData,
  GetBinanceSymbolsInfoQueryKey
>;

/** Build TanStack Query options for {@link getBinanceSymbolsInfo}. */
export function getBinanceSymbolsInfoQueryOptions(
  config: Config,
  options: GetBinanceSymbolsInfoOptions = {},
): GetBinanceSymbolsInfoQueryOptions {
  return {
    staleTime: SYMBOLS_INFO_STALE_TIME_MS,
    ...options.query,
    queryKey: getBinanceSymbolsInfoQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getBinanceSymbolsInfo(config, { chainId: options.chainId, solverId: options.solverId }),
  };
}
