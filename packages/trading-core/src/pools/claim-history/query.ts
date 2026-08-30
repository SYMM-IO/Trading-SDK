import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getClaimHistory, type GetClaimHistoryParameters, type GetClaimHistoryReturnType } from "./get-claim-history";

/** Data resolved by the {@link getClaimHistoryQueryOptions} query. */
export type GetClaimHistoryData = GetClaimHistoryReturnType;

/**
 * Build the TanStack Query key for {@link getClaimHistoryQueryOptions}.
 *
 * The bearer `accessToken` is dropped from the key by `filterQueryOptions` — it
 * is a credential, not a cache dimension, so a refreshed token still hits the
 * same cache entry and the token never leaks into a devtools-visible key.
 *
 * @param options - The action's parameters (including `accessToken`) plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getClaimHistoryQueryKey(options: Compute<GetClaimHistoryParameters & ConfigKeyParameter>) {
  return ["getClaimHistory", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getClaimHistoryQueryKey}. */
export type GetClaimHistoryQueryKey = ReturnType<typeof getClaimHistoryQueryKey>;

/**
 * Options accepted by {@link getClaimHistoryQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetClaimHistoryOptions = Compute<
  GetClaimHistoryParameters & QueryParameter<GetClaimHistoryData, Error, GetClaimHistoryData, GetClaimHistoryQueryKey>
>;

/** TanStack Query options returned by {@link getClaimHistoryQueryOptions}. */
export type GetClaimHistoryQueryOptions = SymmioQueryOptions<
  GetClaimHistoryData,
  Error,
  GetClaimHistoryData,
  GetClaimHistoryQueryKey
>;

/**
 * Build TanStack Query options for {@link getClaimHistory}.
 *
 * @param config - The SDK config.
 * @param options - The action's parameters (including the required `accessToken`) and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getClaimHistoryQueryOptions(config, { accessToken, tokenContractAddress: "0xToken…" }));
 * ```
 */
export function getClaimHistoryQueryOptions(
  config: Config,
  options: GetClaimHistoryOptions,
): GetClaimHistoryQueryOptions {
  return {
    ...options.query,
    queryKey: getClaimHistoryQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getClaimHistory(config, {
        chainId: options.chainId,
        accessToken: options.accessToken,
        tokenContractAddress: options.tokenContractAddress,
        accountAddress: options.accountAddress,
        start: options.start,
        size: options.size,
      }),
  };
}
