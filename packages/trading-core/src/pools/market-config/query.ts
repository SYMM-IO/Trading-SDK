import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getListingMarketConfig,
  type GetListingMarketConfigParameters,
  type GetListingMarketConfigReturnType,
} from "./get-listing-market-config";
import {
  updateListingMarketConfig,
  type UpdateListingMarketConfigParameters,
  type UpdateListingMarketConfigReturnType,
} from "./update-listing-market-config";

/** Data resolved by the {@link getListingMarketConfigQueryOptions} query. */
export type GetListingMarketConfigData = GetListingMarketConfigReturnType;

/**
 * Build the TanStack Query key for {@link getListingMarketConfigQueryOptions}.
 *
 * `accessToken` is dropped by `filterQueryOptions` — it is a credential, not a
 * cache dimension, so a refreshed token hits the same entry and no bearer token
 * ever reaches devtools. The config is nonetheless per-user: scope the cache to
 * the signed-in session in the consuming app if it can switch accounts without
 * remounting.
 *
 * @param options - The action's parameters plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getListingMarketConfigQueryKey(
  options: Compute<GetListingMarketConfigParameters & ConfigKeyParameter>,
) {
  return ["getListingMarketConfig", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getListingMarketConfigQueryKey}. */
export type GetListingMarketConfigQueryKey = ReturnType<typeof getListingMarketConfigQueryKey>;

/**
 * Options accepted by {@link getListingMarketConfigQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetListingMarketConfigOptions = Compute<
  GetListingMarketConfigParameters &
    QueryParameter<GetListingMarketConfigData, Error, GetListingMarketConfigData, GetListingMarketConfigQueryKey>
>;

/** TanStack Query options returned by {@link getListingMarketConfigQueryOptions}. */
export type GetListingMarketConfigQueryOptions = SymmioQueryOptions<
  GetListingMarketConfigData,
  Error,
  GetListingMarketConfigData,
  GetListingMarketConfigQueryKey
>;

/**
 * Build TanStack Query options for {@link getListingMarketConfig}.
 *
 * @param config - The SDK config.
 * @param options - The bearer token, market address, deposit chain, and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getListingMarketConfigQueryOptions(config, {
 *     accessToken: token.accessToken,
 *     tokenContractAddress: "0xToken…",
 *     depositChain: market.chainId,
 *   }),
 * );
 * ```
 */
export function getListingMarketConfigQueryOptions(
  config: Config,
  options: GetListingMarketConfigOptions,
): GetListingMarketConfigQueryOptions {
  return {
    ...options.query,
    queryKey: getListingMarketConfigQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getListingMarketConfig(config, {
        chainId: options.chainId,
        accessToken: options.accessToken,
        tokenContractAddress: options.tokenContractAddress,
        depositChain: options.depositChain,
      }),
  };
}

/**
 * Build TanStack Mutation options for {@link updateListingMarketConfig}. Modeled
 * as a mutation (not a query): it records the caller's opinion and re-blends the
 * pool's configuration, so it is a one-shot write, not cached data.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * const { mutateAsync } = useMutation(updateListingMarketConfigMutationOptions(config));
 * const updated = await mutateAsync({
 *   accessToken: token.accessToken,
 *   tokenContractAddress: "0xToken…",
 *   depositChain: market.chainId,
 *   buybackRatio: 50,
 *   maxLeverage: 20,
 * });
 * ```
 */
export function updateListingMarketConfigMutationOptions(config: Config) {
  return {
    mutationKey: ["updateListingMarketConfig"] as const,
    mutationFn: (variables: UpdateListingMarketConfigParameters): Promise<UpdateListingMarketConfigReturnType> =>
      updateListingMarketConfig(config, variables),
  };
}
