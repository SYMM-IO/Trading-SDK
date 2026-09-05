import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getSymbols, type GetSymbolsParameters, type GetSymbolsReturnType } from "./get-symbols";

/** Data resolved by the {@link getSymbolsQueryOptions} query. */
export type GetSymbolsData = GetSymbolsReturnType;

/** Build the TanStack Query key for {@link getSymbolsQueryOptions}. */
export function getSymbolsQueryKey(options: Compute<GetSymbolsParameters & ConfigKeyParameter> = {}) {
  return ["getSymbols", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSymbolsQueryKey}. */
export type GetSymbolsQueryKey = ReturnType<typeof getSymbolsQueryKey>;

/** Options accepted by {@link getSymbolsQueryOptions}. */
export type GetSymbolsOptions = Compute<
  GetSymbolsParameters & QueryParameter<GetSymbolsData, Error, GetSymbolsData, GetSymbolsQueryKey>
>;

/** TanStack Query options returned by {@link getSymbolsQueryOptions}. */
export type GetSymbolsQueryOptions = SymmioQueryOptions<GetSymbolsData, Error, GetSymbolsData, GetSymbolsQueryKey>;

/**
 * Build TanStack Query options for {@link getSymbols}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters (optional `chainId` / `solverId` / `/symbols` filters) and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getSymbolsQueryOptions(config, { search: "BTC" }));
 * ```
 */
export function getSymbolsQueryOptions(config: Config, options: GetSymbolsOptions = {}): GetSymbolsQueryOptions {
  return {
    ...options.query,
    queryKey: getSymbolsQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getSymbols(config, {
        chainId: options.chainId,
        solverId: options.solverId,
        limit: options.limit,
        offset: options.offset,
        symbolId: options.symbolId,
        search: options.search,
        asset: options.asset,
        tokenAddress: options.tokenAddress,
        isValid: options.isValid,
        stateLong: options.stateLong,
        stateShort: options.stateShort,
      }),
  };
}
