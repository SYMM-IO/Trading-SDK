import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getTransferHistory,
  type GetTransferHistoryParameters,
  type GetTransferHistoryReturnType,
} from "./get-transfer-history";

/** Data resolved by the {@link getTransferHistoryQueryOptions} query. */
export type GetTransferHistoryData = GetTransferHistoryReturnType;

/**
 * Build the TanStack Query key for {@link getTransferHistoryQueryOptions}.
 *
 * @param options - Query parameters (accounts, direction, paging, time range, chain id, config key).
 * @returns A stable, hashable query key.
 */
export function getTransferHistoryQueryKey(options: Compute<GetTransferHistoryParameters & ConfigKeyParameter>) {
  return ["getTransferHistory", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getTransferHistoryQueryKey}. */
export type GetTransferHistoryQueryKey = ReturnType<typeof getTransferHistoryQueryKey>;

/**
 * Options accepted by {@link getTransferHistoryQueryOptions}: the action's
 * parameters plus TanStack overrides.
 */
export type GetTransferHistoryOptions = Compute<
  GetTransferHistoryParameters &
    QueryParameter<GetTransferHistoryData, Error, GetTransferHistoryData, GetTransferHistoryQueryKey>
>;

/** TanStack Query options returned by {@link getTransferHistoryQueryOptions}. */
export type GetTransferHistoryQueryOptions = SymmioQueryOptions<
  GetTransferHistoryData,
  Error,
  GetTransferHistoryData,
  GetTransferHistoryQueryKey
>;

/**
 * Build TanStack Query options for {@link getTransferHistory}. Pass
 * `query.refetchInterval` to poll; the query is disabled until at least one
 * `account` is supplied.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getTransferHistoryQueryOptions(config, { accounts: ["0xsub…"], direction: "outgoing" }));
 * ```
 */
export function getTransferHistoryQueryOptions(
  config: Config,
  options: GetTransferHistoryOptions,
): GetTransferHistoryQueryOptions {
  return {
    ...options.query,
    queryKey: getTransferHistoryQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: (options.query?.enabled ?? true) && options.accounts.length > 0,
    queryFn: () =>
      getTransferHistory(config, {
        chainId: options.chainId,
        accounts: options.accounts,
        direction: options.direction,
        first: options.first,
        skip: options.skip,
        startTime: options.startTime,
        endTime: options.endTime,
        orderDirection: options.orderDirection,
      }),
  };
}
