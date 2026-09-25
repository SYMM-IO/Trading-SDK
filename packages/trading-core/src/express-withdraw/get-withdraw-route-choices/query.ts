import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import type { GetWithdrawRouteChoicesParameters, WithdrawRouteChoices } from "../types";
import { getWithdrawRouteChoices } from "./get-withdraw-route-choices";

/** Data returned by the selectable withdrawal-routes query. */
export type GetWithdrawRouteChoicesData = WithdrawRouteChoices;

/** Build the stable query key for selectable withdrawal routes. */
export function getWithdrawRouteChoicesQueryKey(
  options: Compute<ExactPartial<GetWithdrawRouteChoicesParameters> & ConfigKeyParameter> = {},
) {
  return ["getWithdrawRouteChoices", filterQueryOptions(options)] as const;
}

/** Query-key type for selectable withdrawal routes. */
export type GetWithdrawRouteChoicesQueryKey = ReturnType<typeof getWithdrawRouteChoicesQueryKey>;

/** Options accepted by {@link getWithdrawRouteChoicesQueryOptions}. */
export type GetWithdrawRouteChoicesOptions = GetWithdrawRouteChoicesParameters &
  QueryParameter<WithdrawRouteChoices, Error, WithdrawRouteChoices, GetWithdrawRouteChoicesQueryKey>;

/** TanStack options returned by {@link getWithdrawRouteChoicesQueryOptions}. */
export type GetWithdrawRouteChoicesQueryOptions = SymmioQueryOptions<
  WithdrawRouteChoices,
  Error,
  WithdrawRouteChoices,
  GetWithdrawRouteChoicesQueryKey
>;

/**
 * Build query options for automatic and user-selectable withdrawal routes.
 *
 * Automatic retries are disabled because preparation may call the stateful
 * Express `POST /options` endpoint.
 *
 * @param config - SDK configuration.
 * @param options - Required withdrawal intent and optional query overrides.
 * @returns Options for `useQuery` or `queryClient.fetchQuery`.
 */
export function getWithdrawRouteChoicesQueryOptions(
  config: Config,
  options: GetWithdrawRouteChoicesOptions,
): GetWithdrawRouteChoicesQueryOptions {
  return {
    ...options.query,
    queryKey: getWithdrawRouteChoicesQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    queryFn: () =>
      getWithdrawRouteChoices(config, {
        user: options.user,
        amount: options.amount,
        receiver: options.receiver,
        affiliate: options.affiliate,
        chainId: options.chainId,
        signal: options.signal,
        isolationType: options.isolationType,
        policy: options.policy,
      }),
    retry: options.query?.retry ?? false,
  };
}
