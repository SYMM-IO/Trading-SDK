import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import type { ExpressWithdrawStatus, GetExpressWithdrawStatusParameters } from "../types";
import { getExpressWithdrawStatus } from "./get-express-withdraw-status";

/** Data returned by the Express status query. */
export type GetExpressWithdrawStatusData = ExpressWithdrawStatus;

/** Build the stable query key for an Express status request. */
export function getExpressWithdrawStatusQueryKey(
  options: Compute<ExactPartial<GetExpressWithdrawStatusParameters> & ConfigKeyParameter> = {},
) {
  return ["getExpressWithdrawStatus", filterQueryOptions(options)] as const;
}

/** Query-key type for Express status. */
export type GetExpressWithdrawStatusQueryKey = ReturnType<typeof getExpressWithdrawStatusQueryKey>;

/** Options accepted by {@link getExpressWithdrawStatusQueryOptions}. */
export type GetExpressWithdrawStatusOptions = GetExpressWithdrawStatusParameters &
  QueryParameter<ExpressWithdrawStatus, Error, ExpressWithdrawStatus, GetExpressWithdrawStatusQueryKey>;

/** TanStack options returned by {@link getExpressWithdrawStatusQueryOptions}. */
export type GetExpressWithdrawStatusQueryOptions = SymmioQueryOptions<
  ExpressWithdrawStatus,
  Error,
  ExpressWithdrawStatus,
  GetExpressWithdrawStatusQueryKey
>;

/**
 * Build query options for polling an Express withdrawal status.
 *
 * @param config - SDK configuration.
 * @param options - Required request inputs and optional TanStack overrides.
 * @returns Options for `useQuery` or `queryClient.fetchQuery`.
 */
export function getExpressWithdrawStatusQueryOptions(
  config: Config,
  options: GetExpressWithdrawStatusOptions,
): GetExpressWithdrawStatusQueryOptions {
  return {
    ...options.query,
    queryKey: getExpressWithdrawStatusQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    queryFn: () =>
      getExpressWithdrawStatus(config, {
        user: options.user,
        requestId: options.requestId,
        chainId: options.chainId,
        signal: options.signal,
      }),
  };
}
