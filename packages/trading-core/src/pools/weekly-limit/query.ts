import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getWeeklyListingLimit,
  type GetWeeklyListingLimitParameters,
  type GetWeeklyListingLimitReturnType,
} from "./get-weekly-listing-limit";

/** Data resolved by the {@link getWeeklyListingLimitQueryOptions} query. */
export type GetWeeklyListingLimitData = GetWeeklyListingLimitReturnType;

/**
 * Build the TanStack Query key for {@link getWeeklyListingLimitQueryOptions}.
 *
 * @param options - The action parameters plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getWeeklyListingLimitQueryKey(options: Compute<GetWeeklyListingLimitParameters & ConfigKeyParameter>) {
  return ["getWeeklyListingLimit", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getWeeklyListingLimitQueryKey}. */
export type GetWeeklyListingLimitQueryKey = ReturnType<typeof getWeeklyListingLimitQueryKey>;

/**
 * Options accepted by {@link getWeeklyListingLimitQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetWeeklyListingLimitOptions = Compute<
  GetWeeklyListingLimitParameters &
    QueryParameter<GetWeeklyListingLimitData, Error, GetWeeklyListingLimitData, GetWeeklyListingLimitQueryKey>
>;

/** TanStack Query options returned by {@link getWeeklyListingLimitQueryOptions}. */
export type GetWeeklyListingLimitQueryOptions = SymmioQueryOptions<
  GetWeeklyListingLimitData,
  Error,
  GetWeeklyListingLimitData,
  GetWeeklyListingLimitQueryKey
>;

/**
 * Build TanStack Query options for {@link getWeeklyListingLimit}.
 *
 * @param config - The SDK config.
 * @param options - The action parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getWeeklyListingLimitQueryOptions(config));
 * ```
 */
export function getWeeklyListingLimitQueryOptions(
  config: Config,
  options: GetWeeklyListingLimitOptions = {},
): GetWeeklyListingLimitQueryOptions {
  return {
    ...options.query,
    queryKey: getWeeklyListingLimitQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getWeeklyListingLimit(config, {
        chainId: options.chainId,
        solverId: options.solverId,
      }),
  };
}
