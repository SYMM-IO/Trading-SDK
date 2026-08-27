import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getUserProfit, type GetUserProfitParameters, type GetUserProfitReturnType } from "./get-user-profit";

/** Data resolved by the {@link getUserProfitQueryOptions} query. */
export type GetUserProfitData = GetUserProfitReturnType;

/**
 * Build the TanStack Query key for {@link getUserProfitQueryOptions}.
 *
 * The bearer `accessToken` is dropped from the key by `filterQueryOptions` — it
 * is a credential, not a cache dimension, so two calls that differ only by a
 * refreshed token still hit the same cache entry (and the token never leaks into
 * a devtools-visible key).
 *
 * @param options - The action's parameters (including `accessToken`) plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getUserProfitQueryKey(options: Compute<GetUserProfitParameters & ConfigKeyParameter>) {
  return ["getUserProfit", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getUserProfitQueryKey}. */
export type GetUserProfitQueryKey = ReturnType<typeof getUserProfitQueryKey>;

/**
 * Options accepted by {@link getUserProfitQueryOptions}: the action's parameters,
 * an optional cache scope, and TanStack overrides.
 */
export type GetUserProfitOptions = Compute<
  GetUserProfitParameters & QueryParameter<GetUserProfitData, Error, GetUserProfitData, GetUserProfitQueryKey>
>;

/** TanStack Query options returned by {@link getUserProfitQueryOptions}. */
export type GetUserProfitQueryOptions = SymmioQueryOptions<
  GetUserProfitData,
  Error,
  GetUserProfitData,
  GetUserProfitQueryKey
>;

/**
 * Build TanStack Query options for {@link getUserProfit}.
 *
 * @param config - The SDK config.
 * @param options - The action's parameters (including the required `accessToken`) and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getUserProfitQueryOptions(config, { accessToken, tokenContractAddress: "0x1234…" }));
 * ```
 */
export function getUserProfitQueryOptions(config: Config, options: GetUserProfitOptions): GetUserProfitQueryOptions {
  return {
    ...options.query,
    queryKey: getUserProfitQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getUserProfit(config, {
        chainId: options.chainId,
        accessToken: options.accessToken,
        tokenContractAddress: options.tokenContractAddress,
      }),
  };
}
