import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getRetryListingInfo,
  type GetRetryListingInfoParameters,
  type GetRetryListingInfoReturnType,
} from "./get-retry-listing-info";
import { retryListing, type RetryListingParameters, type RetryListingReturnType } from "./retry-listing";

/** Data resolved by the {@link getRetryListingInfoQueryOptions} query. */
export type GetRetryListingInfoData = GetRetryListingInfoReturnType;

/**
 * Build the TanStack Query key for {@link getRetryListingInfoQueryOptions}.
 *
 * The bearer `accessToken` is dropped from the key by `filterQueryOptions` — it
 * is a credential, not a cache dimension.
 *
 * @param options - The action's parameters (including `accessToken`) plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getRetryListingInfoQueryKey(options: Compute<GetRetryListingInfoParameters & ConfigKeyParameter>) {
  return ["getRetryListingInfo", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getRetryListingInfoQueryKey}. */
export type GetRetryListingInfoQueryKey = ReturnType<typeof getRetryListingInfoQueryKey>;

/** Options accepted by {@link getRetryListingInfoQueryOptions}. */
export type GetRetryListingInfoOptions = Compute<
  GetRetryListingInfoParameters &
    QueryParameter<GetRetryListingInfoData, Error, GetRetryListingInfoData, GetRetryListingInfoQueryKey>
>;

/** TanStack Query options returned by {@link getRetryListingInfoQueryOptions}. */
export type GetRetryListingInfoQueryOptions = SymmioQueryOptions<
  GetRetryListingInfoData,
  Error,
  GetRetryListingInfoData,
  GetRetryListingInfoQueryKey
>;

/**
 * Build TanStack Query options for {@link getRetryListingInfo}.
 *
 * @param config - The SDK config.
 * @param options - The action's parameters (including the required `accessToken`) and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getRetryListingInfoQueryOptions(
  config: Config,
  options: GetRetryListingInfoOptions,
): GetRetryListingInfoQueryOptions {
  return {
    ...options.query,
    queryKey: getRetryListingInfoQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getRetryListingInfo(config, {
        chainId: options.chainId,
        accessToken: options.accessToken,
        tokenContractAddress: options.tokenContractAddress,
        depositChain: options.depositChain,
      }),
  };
}

/**
 * Build TanStack Mutation options for {@link retryListing}. Modeled as a mutation:
 * it re-submits a rejected market and consumes a retry, so it is a one-shot write,
 * not cached data.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 */
export function retryListingMutationOptions(config: Config) {
  return {
    mutationKey: ["retryListing"] as const,
    mutationFn: (variables: RetryListingParameters): Promise<RetryListingReturnType> => retryListing(config, variables),
  };
}
