import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getMarkPrices, type GetMarkPricesParameters, type GetMarkPricesReturnType } from "./get-mark-prices";

/** Data resolved by the {@link getMarkPricesQueryOptions} query. */
export type GetMarkPricesData = GetMarkPricesReturnType;

/**
 * Build the TanStack Query key for {@link getMarkPricesQueryOptions}.
 *
 * @param options - Query parameters (chain id, solver id, names, config key).
 * @returns A stable, hashable query key.
 */
export function getMarkPricesQueryKey(options: Compute<GetMarkPricesParameters & ConfigKeyParameter> = {}) {
  return ["getMarkPrices", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getMarkPricesQueryKey}. */
export type GetMarkPricesQueryKey = ReturnType<typeof getMarkPricesQueryKey>;

/**
 * Options accepted by {@link getMarkPricesQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetMarkPricesOptions = Compute<
  GetMarkPricesParameters & QueryParameter<GetMarkPricesData, Error, GetMarkPricesData, GetMarkPricesQueryKey>
>;

/** TanStack Query options returned by {@link getMarkPricesQueryOptions}. */
export type GetMarkPricesQueryOptions = SymmioQueryOptions<
  GetMarkPricesData,
  Error,
  GetMarkPricesData,
  GetMarkPricesQueryKey
>;

/**
 * Build TanStack Query options for {@link getMarkPrices}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getMarkPricesQueryOptions(config, { solverId: "rasa", names: ["BTCUSDT"] }));
 * ```
 */
export function getMarkPricesQueryOptions(
  config: Config,
  options: GetMarkPricesOptions = {},
): GetMarkPricesQueryOptions {
  return {
    ...options.query,
    queryKey: getMarkPricesQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    /**
     * Every identifying parameter must be enumerated here.
     *
     * `filterQueryOptions` is a blacklist, so a new field lands in the cache key
     * automatically — but this list is manual. Forgetting one produces the worst
     * failure mode available: each variant gets its own cache entry (so it looks
     * isolated) while every entry is populated from the default's data. No error,
     * no type error. `query.test.ts` asserts this call with an exact object
     * literal so an added-but-unforwarded field fails the build.
     */
    queryFn: () =>
      getMarkPrices(config, {
        chainId: options.chainId,
        solverId: options.solverId,
        names: options.names,
      }),
  };
}
