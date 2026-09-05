import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getListingStatus,
  type GetListingStatusParameters,
  type GetListingStatusReturnType,
} from "./get-listing-status";

/** Data resolved by the {@link getListingStatusQueryOptions} query. */
export type GetListingStatusData = GetListingStatusReturnType;

/**
 * Build the TanStack Query key for {@link getListingStatusQueryOptions}.
 *
 * @param options - The action's parameters plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getListingStatusQueryKey(options: Compute<GetListingStatusParameters & ConfigKeyParameter>) {
  return ["getListingStatus", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getListingStatusQueryKey}. */
export type GetListingStatusQueryKey = ReturnType<typeof getListingStatusQueryKey>;

/**
 * Options accepted by {@link getListingStatusQueryOptions}: the action's
 * parameters and TanStack overrides. Set `query.refetchInterval` to poll a
 * non-terminal status.
 */
export type GetListingStatusOptions = Compute<
  GetListingStatusParameters &
    QueryParameter<GetListingStatusData, Error, GetListingStatusData, GetListingStatusQueryKey>
>;

/** TanStack Query options returned by {@link getListingStatusQueryOptions}. */
export type GetListingStatusQueryOptions = SymmioQueryOptions<
  GetListingStatusData,
  Error,
  GetListingStatusData,
  GetListingStatusQueryKey
>;

/**
 * Build TanStack Query options for {@link getListingStatus}.
 *
 * @param config - The SDK config.
 * @param options - The action's parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getListingStatusQueryOptions(config, {
 *     tokenContractAddress: "0x1234…",
 *     depositChain: ListingDepositChainId.HYPER_EVM,
 *     query: { refetchInterval: 5000 },
 *   }),
 * );
 * ```
 */
export function getListingStatusQueryOptions(
  config: Config,
  options: GetListingStatusOptions,
): GetListingStatusQueryOptions {
  return {
    ...options.query,
    queryKey: getListingStatusQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getListingStatus(config, {
        chainId: options.chainId,
        tokenContractAddress: options.tokenContractAddress,
        depositChain: options.depositChain,
      }),
  };
}
