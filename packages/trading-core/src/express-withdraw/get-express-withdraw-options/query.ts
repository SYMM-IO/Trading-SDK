import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import type { ExpressWithdrawOptions, GetExpressWithdrawOptionsParameters } from "../types";
import { getExpressWithdrawOptions } from "./get-express-withdraw-options";

/** Data returned by the Express options query. */
export type GetExpressWithdrawOptionsData = ExpressWithdrawOptions;

/** Build the stable query key for an Express options request. */
export function getExpressWithdrawOptionsQueryKey(
  options: Compute<ExactPartial<GetExpressWithdrawOptionsParameters> & ConfigKeyParameter> = {},
) {
  return ["getExpressWithdrawOptions", filterQueryOptions(options)] as const;
}

/** Query-key type for Express options. */
export type GetExpressWithdrawOptionsQueryKey = ReturnType<typeof getExpressWithdrawOptionsQueryKey>;

/** Options accepted by {@link getExpressWithdrawOptionsQueryOptions}. */
export type GetExpressWithdrawOptionsOptions = GetExpressWithdrawOptionsParameters &
  QueryParameter<ExpressWithdrawOptions, Error, ExpressWithdrawOptions, GetExpressWithdrawOptionsQueryKey>;

/** TanStack options returned by {@link getExpressWithdrawOptionsQueryOptions}. */
export type GetExpressWithdrawOptionsQueryOptions = SymmioQueryOptions<
  ExpressWithdrawOptions,
  Error,
  ExpressWithdrawOptions,
  GetExpressWithdrawOptionsQueryKey
>;

/**
 * Build a non-retrying query for `POST /options`.
 *
 * @param config - SDK configuration.
 * @param options - Required request inputs and optional TanStack overrides.
 * @returns Options for `useQuery` or `queryClient.fetchQuery`.
 */
export function getExpressWithdrawOptionsQueryOptions(
  config: Config,
  options: GetExpressWithdrawOptionsOptions,
): GetExpressWithdrawOptionsQueryOptions {
  return {
    ...options.query,
    queryKey: getExpressWithdrawOptionsQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    queryFn: () =>
      getExpressWithdrawOptions(config, {
        user: options.user,
        amount: options.amount,
        receiver: options.receiver,
        affiliate: options.affiliate,
        chainId: options.chainId,
        signal: options.signal,
      }),
  };
}
