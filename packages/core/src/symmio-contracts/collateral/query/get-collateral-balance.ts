import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getCollateralBalance,
  type GetCollateralBalanceParameters,
  type GetCollateralBalanceReturnType,
} from "../actions/get-collateral-balance";

/** Data resolved by the {@link getCollateralBalanceQueryOptions} query. */
export type GetCollateralBalanceData = GetCollateralBalanceReturnType;

/**
 * Build the TanStack Query key for {@link getCollateralBalanceQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, owner).
 * @returns A stable, hashable query key.
 */
export function getCollateralBalanceQueryKey(
  options: Compute<ExactPartial<GetCollateralBalanceParameters> & ConfigKeyParameter> = {},
) {
  return ["getCollateralBalance", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getCollateralBalanceQueryKey}. */
export type GetCollateralBalanceQueryKey = ReturnType<typeof getCollateralBalanceQueryKey>;

/**
 * Options accepted by {@link getCollateralBalanceQueryOptions}: the action's
 * parameters (all optional), an optional cache scope, and TanStack overrides.
 */
export type GetCollateralBalanceOptions = Compute<
  ExactPartial<GetCollateralBalanceParameters> &
    QueryParameter<GetCollateralBalanceData, Error, GetCollateralBalanceData, GetCollateralBalanceQueryKey>
>;

/** TanStack Query options returned by {@link getCollateralBalanceQueryOptions}. */
export type GetCollateralBalanceQueryOptions = SymmioQueryOptions<
  GetCollateralBalanceData,
  Error,
  GetCollateralBalanceData,
  GetCollateralBalanceQueryKey
>;

/**
 * Build TanStack Query options for {@link getCollateralBalance}. The query is
 * disabled until `owner` is set. An unsupported chain surfaces a {@link SymmError}
 * from the query function (it is not silently disabled).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getCollateralBalanceQueryOptions(config, { owner, chainId }));
 * ```
 */
export function getCollateralBalanceQueryOptions(
  config: Config,
  options: GetCollateralBalanceOptions = {},
): GetCollateralBalanceQueryOptions {
  return {
    ...options.query,
    queryKey: getCollateralBalanceQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: Boolean(options.owner) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, owner } = options;
      if (!owner) {
        throw new SymmError("validation", "MISSING_OWNER", "getCollateralBalance: `owner` is required.");
      }
      return getCollateralBalance(config, { chainId, owner });
    },
  };
}
