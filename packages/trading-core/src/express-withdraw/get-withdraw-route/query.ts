import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import type { GetWithdrawRouteParameters, WithdrawRoute } from "../types";
import { getWithdrawRoute } from "./get-withdraw-route";

/** Data returned by the withdrawal route query. */
export type GetWithdrawRouteData = WithdrawRoute;

/** Build the stable query key for route preparation. */
export function getWithdrawRouteQueryKey(
  options: Compute<ExactPartial<GetWithdrawRouteParameters> & ConfigKeyParameter> = {},
) {
  return ["getWithdrawRoute", filterQueryOptions(options)] as const;
}

/** Query-key type for withdrawal route preparation. */
export type GetWithdrawRouteQueryKey = ReturnType<typeof getWithdrawRouteQueryKey>;

/** Options accepted by {@link getWithdrawRouteQueryOptions}. */
export type GetWithdrawRouteOptions = GetWithdrawRouteParameters &
  QueryParameter<WithdrawRoute, Error, WithdrawRoute, GetWithdrawRouteQueryKey>;

/** TanStack options returned by {@link getWithdrawRouteQueryOptions}. */
export type GetWithdrawRouteQueryOptions = SymmioQueryOptions<
  WithdrawRoute,
  Error,
  WithdrawRoute,
  GetWithdrawRouteQueryKey
>;

/**
 * Build query options for preparing an Express-aware withdrawal route.
 *
 * Automatic retries are disabled because preparation may call `POST /options`.
 *
 * @param config - SDK configuration.
 * @param options - Required withdrawal intent and optional query overrides.
 * @returns Options for `useQuery` or `queryClient.fetchQuery`.
 */
export function getWithdrawRouteQueryOptions(
  config: Config,
  options: GetWithdrawRouteOptions,
): GetWithdrawRouteQueryOptions {
  return {
    ...options.query,
    queryKey: getWithdrawRouteQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    queryFn: () =>
      getWithdrawRoute(config, {
        user: options.user,
        amount: options.amount,
        receiver: options.receiver,
        affiliate: options.affiliate,
        chainId: options.chainId,
        signal: options.signal,
        isolationType: options.isolationType,
        policy: options.policy,
      }),
  };
}
