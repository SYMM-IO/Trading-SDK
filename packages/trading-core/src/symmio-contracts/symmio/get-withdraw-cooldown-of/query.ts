import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getWithdrawCooldownOf,
  type GetWithdrawCooldownOfParameters,
  type GetWithdrawCooldownOfReturnType,
} from "./get-withdraw-cooldown-of";

/** Query data returned by {@link getWithdrawCooldownOfQueryOptions}. */
export type GetWithdrawCooldownOfData = GetWithdrawCooldownOfReturnType;

/**
 * Build the query key for {@link getWithdrawCooldownOf}.
 *
 * @param options - Action parameters and optional deployment cache scope.
 * @returns A stable query key.
 */
export function getWithdrawCooldownOfQueryKey(options: Compute<GetWithdrawCooldownOfParameters & ConfigKeyParameter>) {
  return ["getWithdrawCooldownOf", filterQueryOptions(options)] as const;
}

/** Key returned by {@link getWithdrawCooldownOfQueryKey}. */
export type GetWithdrawCooldownOfQueryKey = ReturnType<typeof getWithdrawCooldownOfQueryKey>;

/** Action parameters and query overrides for {@link getWithdrawCooldownOfQueryOptions}. */
export type GetWithdrawCooldownOfOptions = Compute<
  GetWithdrawCooldownOfParameters &
    QueryParameter<GetWithdrawCooldownOfData, Error, GetWithdrawCooldownOfData, GetWithdrawCooldownOfQueryKey>
>;

/** TanStack options returned by {@link getWithdrawCooldownOfQueryOptions}. */
export type GetWithdrawCooldownOfQueryOptions = SymmioQueryOptions<
  GetWithdrawCooldownOfData,
  Error,
  GetWithdrawCooldownOfData,
  GetWithdrawCooldownOfQueryKey
>;

/**
 * Build deployment-scoped TanStack query options for {@link getWithdrawCooldownOf}.
 * An unsupported chain surfaces a {@link SymmError} from the query function.
 *
 * @param config - SDK configuration.
 * @param options - Action parameters and optional TanStack overrides.
 * @returns Query options with the SDK-owned function and key.
 *
 * @example
 * ```ts
 * useQuery(getWithdrawCooldownOfQueryOptions(config, { user: account }));
 * ```
 */
export function getWithdrawCooldownOfQueryOptions(
  config: Config,
  options: GetWithdrawCooldownOfOptions,
): GetWithdrawCooldownOfQueryOptions {
  return {
    ...options.query,
    queryKey: getWithdrawCooldownOfQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getWithdrawCooldownOf(config, { user: options.user, chainId: options.chainId }),
  };
}
