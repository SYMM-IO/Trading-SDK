import type { Config } from "../../../core/config";
import type { ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getPendingWithdrawRequestsBatch,
  type GetPendingWithdrawRequestsBatchParameters,
  type GetPendingWithdrawRequestsBatchReturnType,
} from "./get-pending-withdraw-requests-batch";
/** Data returned by the complete pending-withdrawal batch query. */
export type GetPendingWithdrawRequestsBatchData = GetPendingWithdrawRequestsBatchReturnType;
/** Stable key matching duplicate/case/order-equivalent user sets. */
export function getPendingWithdrawRequestsBatchQueryKey(
  options: ExactPartial<GetPendingWithdrawRequestsBatchParameters> & ConfigKeyParameter = {},
) {
  const { users = [], pageSize = 200n } = options;
  return [
    "getPendingWithdrawRequestsBatch",
    filterQueryOptions({ ...options, users: [...new Set(users.map((user) => user.toLowerCase()))].sort(), pageSize }),
  ] as const;
}
/** Key type of the complete pending-withdrawal batch query. */
export type GetPendingWithdrawRequestsBatchQueryKey = ReturnType<typeof getPendingWithdrawRequestsBatchQueryKey>;
/** Batch read inputs and standard TanStack query overrides. */
export type GetPendingWithdrawRequestsBatchOptions = ExactPartial<GetPendingWithdrawRequestsBatchParameters> &
  QueryParameter<
    GetPendingWithdrawRequestsBatchData,
    Error,
    GetPendingWithdrawRequestsBatchData,
    GetPendingWithdrawRequestsBatchQueryKey
  >;
/** Standard query options for the batch read. */
export type GetPendingWithdrawRequestsBatchQueryOptions = SymmioQueryOptions<
  GetPendingWithdrawRequestsBatchData,
  Error,
  GetPendingWithdrawRequestsBatchData,
  GetPendingWithdrawRequestsBatchQueryKey
>;
/**
 * Build a complete pending-withdrawal query. Empty users disable automatic reads.
 * @param config - SDK configuration.
 * @param options - Users, chain, page size and query overrides.
 * @returns Query key, enabled state and query function.
 */
export function getPendingWithdrawRequestsBatchQueryOptions(
  config: Config,
  options: GetPendingWithdrawRequestsBatchOptions = {},
): GetPendingWithdrawRequestsBatchQueryOptions {
  return {
    ...options.query,
    queryKey: getPendingWithdrawRequestsBatchQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: Boolean(options.users?.length) && (options.query?.enabled ?? true),
    queryFn: () =>
      getPendingWithdrawRequestsBatch(config, {
        users: options.users ?? [],
        chainId: options.chainId,
        pageSize: options.pageSize,
      }),
  };
}
