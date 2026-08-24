import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getTradeVolume, type GetTradeVolumeParameters, type GetTradeVolumeReturnType } from "./get-trade-volume";

/** Data resolved by the {@link getTradeVolumeQueryOptions} query. */
export type GetTradeVolumeData = GetTradeVolumeReturnType;

/** Build the TanStack Query key for {@link getTradeVolumeQueryOptions}. */
export function getTradeVolumeQueryKey(options: Compute<GetTradeVolumeParameters & ConfigKeyParameter>) {
  return ["getTradeVolume", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getTradeVolumeQueryKey}. */
export type GetTradeVolumeQueryKey = ReturnType<typeof getTradeVolumeQueryKey>;

/** Options accepted by {@link getTradeVolumeQueryOptions}: the action's parameters plus TanStack overrides. */
export type GetTradeVolumeOptions = Compute<
  GetTradeVolumeParameters & QueryParameter<GetTradeVolumeData, Error, GetTradeVolumeData, GetTradeVolumeQueryKey>
>;

/** TanStack Query options returned by {@link getTradeVolumeQueryOptions}. */
export type GetTradeVolumeQueryOptions = SymmioQueryOptions<
  GetTradeVolumeData,
  Error,
  GetTradeVolumeData,
  GetTradeVolumeQueryKey
>;

/**
 * Build TanStack Query options for {@link getTradeVolume}. The query is disabled
 * when `symbolId` is `0` (the sentinel for "no market selected").
 *
 * @param config - The SDK config.
 * @param options - Query parameters (required `symbolId`, optional `chainId` / `solverId`) and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getTradeVolumeQueryOptions(config, { symbolId: 1 }));
 * ```
 */
export function getTradeVolumeQueryOptions(config: Config, options: GetTradeVolumeOptions): GetTradeVolumeQueryOptions {
  return {
    ...options.query,
    queryKey: getTradeVolumeQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: (options.query?.enabled ?? true) && options.symbolId > 0,
    queryFn: () =>
      getTradeVolume(config, {
        chainId: options.chainId,
        solverId: options.solverId,
        symbolId: options.symbolId,
      }),
  };
}
