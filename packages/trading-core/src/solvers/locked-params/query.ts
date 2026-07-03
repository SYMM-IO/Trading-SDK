import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getLockedParams, type GetLockedParamsParameters, type GetLockedParamsReturnType } from "./get-locked-params";

/** Data resolved by the {@link getLockedParamsQueryOptions} query. */
export type GetLockedParamsData = GetLockedParamsReturnType;

/**
 * Build the TanStack Query key for {@link getLockedParamsQueryOptions}.
 *
 * @param options - Query parameters (chain id, symbol, leverage).
 * @returns A stable, hashable query key.
 */
export function getLockedParamsQueryKey(options: Compute<GetLockedParamsParameters & ConfigKeyParameter>) {
  return ["getLockedParams", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getLockedParamsQueryKey}. */
export type GetLockedParamsQueryKey = ReturnType<typeof getLockedParamsQueryKey>;

/**
 * Options accepted by {@link getLockedParamsQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetLockedParamsOptions = Compute<
  GetLockedParamsParameters & QueryParameter<GetLockedParamsData, Error, GetLockedParamsData, GetLockedParamsQueryKey>
>;

/** TanStack Query options returned by {@link getLockedParamsQueryOptions}. */
export type GetLockedParamsQueryOptions = SymmioQueryOptions<
  GetLockedParamsData,
  Error,
  GetLockedParamsData,
  GetLockedParamsQueryKey
>;

/**
 * Build TanStack Query options for {@link getLockedParams}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getLockedParamsQueryOptions(config, { symbol: "BTCUSDT", leverage: 5 }));
 * ```
 */
export function getLockedParamsQueryOptions(
  config: Config,
  options: GetLockedParamsOptions,
): GetLockedParamsQueryOptions {
  return {
    ...options.query,
    queryKey: getLockedParamsQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getLockedParams(config, { chainId: options.chainId, symbol: options.symbol, leverage: options.leverage }),
  };
}
