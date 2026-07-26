import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getOpenInterestBySymbolId,
  type GetOpenInterestBySymbolIdParameters,
  type GetOpenInterestBySymbolIdReturnType,
} from "./get-open-interest-by-symbol-id";

/** Data resolved by the {@link getOpenInterestBySymbolIdQueryOptions} query. */
export type GetOpenInterestBySymbolIdData = GetOpenInterestBySymbolIdReturnType;

/** Build the TanStack Query key for {@link getOpenInterestBySymbolIdQueryOptions}. */
export function getOpenInterestBySymbolIdQueryKey(
  options: Compute<GetOpenInterestBySymbolIdParameters & ConfigKeyParameter>,
) {
  return ["getOpenInterestBySymbolId", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getOpenInterestBySymbolIdQueryKey}. */
export type GetOpenInterestBySymbolIdQueryKey = ReturnType<typeof getOpenInterestBySymbolIdQueryKey>;

/** Options accepted by {@link getOpenInterestBySymbolIdQueryOptions}. */
export type GetOpenInterestBySymbolIdOptions = Compute<
  GetOpenInterestBySymbolIdParameters &
    QueryParameter<
      GetOpenInterestBySymbolIdData,
      Error,
      GetOpenInterestBySymbolIdData,
      GetOpenInterestBySymbolIdQueryKey
    >
>;

/** TanStack Query options returned by {@link getOpenInterestBySymbolIdQueryOptions}. */
export type GetOpenInterestBySymbolIdQueryOptions = SymmioQueryOptions<
  GetOpenInterestBySymbolIdData,
  Error,
  GetOpenInterestBySymbolIdData,
  GetOpenInterestBySymbolIdQueryKey
>;

/**
 * Build TanStack Query options for {@link getOpenInterestBySymbolId}. Disabled
 * when `symbolId` is `0`.
 */
export function getOpenInterestBySymbolIdQueryOptions(
  config: Config,
  options: GetOpenInterestBySymbolIdOptions,
): GetOpenInterestBySymbolIdQueryOptions {
  return {
    ...options.query,
    queryKey: getOpenInterestBySymbolIdQueryKey({
      ...options,
      configKey: config.getSolverKey({ chainId: options.chainId, solverId: options.solverId }),
    }),
    enabled: (options.query?.enabled ?? true) && options.symbolId > 0,
    queryFn: () =>
      getOpenInterestBySymbolId(config, {
        chainId: options.chainId,
        solverId: options.solverId,
        symbolId: options.symbolId,
      }),
  };
}
