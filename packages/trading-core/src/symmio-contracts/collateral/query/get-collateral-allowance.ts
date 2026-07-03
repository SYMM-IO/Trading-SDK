import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getCollateralAllowance,
  type GetCollateralAllowanceParameters,
  type GetCollateralAllowanceReturnType,
} from "../actions/get-collateral-allowance";

/** Data resolved by the {@link getCollateralAllowanceQueryOptions} query. */
export type GetCollateralAllowanceData = GetCollateralAllowanceReturnType;

/**
 * Build the TanStack Query key for {@link getCollateralAllowanceQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, owner).
 * @returns A stable, hashable query key.
 */
export function getCollateralAllowanceQueryKey(
  options: Compute<ExactPartial<GetCollateralAllowanceParameters> & ConfigKeyParameter> = {},
) {
  return ["getCollateralAllowance", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getCollateralAllowanceQueryKey}. */
export type GetCollateralAllowanceQueryKey = ReturnType<typeof getCollateralAllowanceQueryKey>;

/**
 * Options accepted by {@link getCollateralAllowanceQueryOptions}: the action's
 * parameters (all optional), an optional cache scope, and TanStack overrides.
 */
export type GetCollateralAllowanceOptions = Compute<
  ExactPartial<GetCollateralAllowanceParameters> &
    QueryParameter<GetCollateralAllowanceData, Error, GetCollateralAllowanceData, GetCollateralAllowanceQueryKey>
>;

/** TanStack Query options returned by {@link getCollateralAllowanceQueryOptions}. */
export type GetCollateralAllowanceQueryOptions = SymmioQueryOptions<
  GetCollateralAllowanceData,
  Error,
  GetCollateralAllowanceData,
  GetCollateralAllowanceQueryKey
>;

/**
 * Build TanStack Query options for {@link getCollateralAllowance}. The query is
 * disabled until `owner` is set. An unsupported chain surfaces a {@link SymmError}
 * from the query function (it is not silently disabled).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getCollateralAllowanceQueryOptions(config, { owner, chainId }));
 * ```
 */
export function getCollateralAllowanceQueryOptions(
  config: Config,
  options: GetCollateralAllowanceOptions = {},
): GetCollateralAllowanceQueryOptions {
  return {
    ...options.query,
    queryKey: getCollateralAllowanceQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: Boolean(options.owner) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, owner } = options;
      if (!owner) {
        throw new SymmError("validation", "MISSING_OWNER", "getCollateralAllowance: `owner` is required.");
      }
      return getCollateralAllowance(config, { chainId, owner });
    },
  };
}
