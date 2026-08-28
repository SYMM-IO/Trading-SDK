import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getPoolRewardChart,
  type GetPoolRewardChartParameters,
  type GetPoolRewardChartReturnType,
} from "./get-pool-reward-chart";
import {
  getPoolTotalReward,
  type GetPoolTotalRewardParameters,
  type GetPoolTotalRewardReturnType,
} from "./get-pool-total-reward";
import {
  getUserRewardChart,
  type GetUserRewardChartParameters,
  type GetUserRewardChartReturnType,
} from "./get-user-reward-chart";
import {
  getUserTotalReward,
  type GetUserTotalRewardParameters,
  type GetUserTotalRewardReturnType,
} from "./get-user-total-reward";

/** Data resolved by the {@link getPoolRewardChartQueryOptions} query. */
export type GetPoolRewardChartData = GetPoolRewardChartReturnType;

/**
 * Build the TanStack Query key for {@link getPoolRewardChartQueryOptions}.
 *
 * @param options - Query parameters plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getPoolRewardChartQueryKey(options: Compute<GetPoolRewardChartParameters & ConfigKeyParameter>) {
  return ["getPoolRewardChart", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getPoolRewardChartQueryKey}. */
export type GetPoolRewardChartQueryKey = ReturnType<typeof getPoolRewardChartQueryKey>;

/**
 * Options accepted by {@link getPoolRewardChartQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetPoolRewardChartOptions = Compute<
  GetPoolRewardChartParameters &
    QueryParameter<GetPoolRewardChartData, Error, GetPoolRewardChartData, GetPoolRewardChartQueryKey>
>;

/** TanStack Query options returned by {@link getPoolRewardChartQueryOptions}. */
export type GetPoolRewardChartQueryOptions = SymmioQueryOptions<
  GetPoolRewardChartData,
  Error,
  GetPoolRewardChartData,
  GetPoolRewardChartQueryKey
>;

/**
 * Build TanStack Query options for {@link getPoolRewardChart}.
 *
 * @param config - The SDK config.
 * @param options - The action's parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getPoolRewardChartQueryOptions(config, {
 *     marketAddress: "0x1234…",
 *     marketChainId: ListingDepositChainId.BASE,
 *   }),
 * );
 * ```
 */
export function getPoolRewardChartQueryOptions(
  config: Config,
  options: GetPoolRewardChartOptions,
): GetPoolRewardChartQueryOptions {
  return {
    ...options.query,
    queryKey: getPoolRewardChartQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getPoolRewardChart(config, {
        chainId: options.chainId,
        marketAddress: options.marketAddress,
        marketChainId: options.marketChainId,
      }),
  };
}

/** Data resolved by the {@link getPoolTotalRewardQueryOptions} query. */
export type GetPoolTotalRewardData = GetPoolTotalRewardReturnType;

/**
 * Build the TanStack Query key for {@link getPoolTotalRewardQueryOptions}.
 *
 * @param options - Query parameters plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getPoolTotalRewardQueryKey(options: Compute<GetPoolTotalRewardParameters & ConfigKeyParameter>) {
  return ["getPoolTotalReward", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getPoolTotalRewardQueryKey}. */
export type GetPoolTotalRewardQueryKey = ReturnType<typeof getPoolTotalRewardQueryKey>;

/**
 * Options accepted by {@link getPoolTotalRewardQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetPoolTotalRewardOptions = Compute<
  GetPoolTotalRewardParameters &
    QueryParameter<GetPoolTotalRewardData, Error, GetPoolTotalRewardData, GetPoolTotalRewardQueryKey>
>;

/** TanStack Query options returned by {@link getPoolTotalRewardQueryOptions}. */
export type GetPoolTotalRewardQueryOptions = SymmioQueryOptions<
  GetPoolTotalRewardData,
  Error,
  GetPoolTotalRewardData,
  GetPoolTotalRewardQueryKey
>;

/**
 * Build TanStack Query options for {@link getPoolTotalReward}.
 *
 * @param config - The SDK config.
 * @param options - The action's parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getPoolTotalRewardQueryOptions(config, {
 *     marketAddress: "0x1234…",
 *     marketChainId: ListingDepositChainId.BASE,
 *     days: 30,
 *   }),
 * );
 * ```
 */
export function getPoolTotalRewardQueryOptions(
  config: Config,
  options: GetPoolTotalRewardOptions,
): GetPoolTotalRewardQueryOptions {
  return {
    ...options.query,
    queryKey: getPoolTotalRewardQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getPoolTotalReward(config, {
        chainId: options.chainId,
        marketAddress: options.marketAddress,
        marketChainId: options.marketChainId,
        days: options.days,
      }),
  };
}

/** Data resolved by the {@link getUserRewardChartQueryOptions} query. */
export type GetUserRewardChartData = GetUserRewardChartReturnType;

/**
 * Build the TanStack Query key for {@link getUserRewardChartQueryOptions}.
 *
 * The bearer `accessToken` is dropped from the key by `filterQueryOptions` — it
 * is a credential, not a cache dimension, so a refreshed token still hits the
 * same cache entry and the token never leaks into a devtools-visible key.
 *
 * @param options - The action's parameters (including `accessToken`) plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getUserRewardChartQueryKey(options: Compute<GetUserRewardChartParameters & ConfigKeyParameter>) {
  return ["getUserRewardChart", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getUserRewardChartQueryKey}. */
export type GetUserRewardChartQueryKey = ReturnType<typeof getUserRewardChartQueryKey>;

/**
 * Options accepted by {@link getUserRewardChartQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetUserRewardChartOptions = Compute<
  GetUserRewardChartParameters &
    QueryParameter<GetUserRewardChartData, Error, GetUserRewardChartData, GetUserRewardChartQueryKey>
>;

/** TanStack Query options returned by {@link getUserRewardChartQueryOptions}. */
export type GetUserRewardChartQueryOptions = SymmioQueryOptions<
  GetUserRewardChartData,
  Error,
  GetUserRewardChartData,
  GetUserRewardChartQueryKey
>;

/**
 * Build TanStack Query options for {@link getUserRewardChart}.
 *
 * @param config - The SDK config.
 * @param options - The action's parameters (including the required `accessToken`) and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getUserRewardChartQueryOptions(config, { accessToken }));
 * ```
 */
export function getUserRewardChartQueryOptions(
  config: Config,
  options: GetUserRewardChartOptions,
): GetUserRewardChartQueryOptions {
  return {
    ...options.query,
    queryKey: getUserRewardChartQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getUserRewardChart(config, { chainId: options.chainId, accessToken: options.accessToken }),
  };
}

/** Data resolved by the {@link getUserTotalRewardQueryOptions} query. */
export type GetUserTotalRewardData = GetUserTotalRewardReturnType;

/**
 * Build the TanStack Query key for {@link getUserTotalRewardQueryOptions}.
 *
 * The bearer `accessToken` is dropped from the key by `filterQueryOptions`; the
 * `userAddress` is kept, since it is what the figure is actually scoped to.
 *
 * @param options - The action's parameters (including `accessToken`) plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getUserTotalRewardQueryKey(options: Compute<GetUserTotalRewardParameters & ConfigKeyParameter>) {
  return ["getUserTotalReward", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getUserTotalRewardQueryKey}. */
export type GetUserTotalRewardQueryKey = ReturnType<typeof getUserTotalRewardQueryKey>;

/**
 * Options accepted by {@link getUserTotalRewardQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetUserTotalRewardOptions = Compute<
  GetUserTotalRewardParameters &
    QueryParameter<GetUserTotalRewardData, Error, GetUserTotalRewardData, GetUserTotalRewardQueryKey>
>;

/** TanStack Query options returned by {@link getUserTotalRewardQueryOptions}. */
export type GetUserTotalRewardQueryOptions = SymmioQueryOptions<
  GetUserTotalRewardData,
  Error,
  GetUserTotalRewardData,
  GetUserTotalRewardQueryKey
>;

/**
 * Build TanStack Query options for {@link getUserTotalReward}.
 *
 * @param config - The SDK config.
 * @param options - The action's parameters (including the required `accessToken`) and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getUserTotalRewardQueryOptions(config, { accessToken, userAddress, days: 30 }));
 * ```
 */
export function getUserTotalRewardQueryOptions(
  config: Config,
  options: GetUserTotalRewardOptions,
): GetUserTotalRewardQueryOptions {
  return {
    ...options.query,
    queryKey: getUserTotalRewardQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getUserTotalReward(config, {
        chainId: options.chainId,
        accessToken: options.accessToken,
        userAddress: options.userAddress,
        days: options.days,
      }),
  };
}
