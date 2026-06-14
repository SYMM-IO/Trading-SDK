import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getVirtualAccount,
  type GetVirtualAccountParameters,
  type GetVirtualAccountReturnType,
} from "../actions/get-virtual-account";

/** Data resolved by the {@link getVirtualAccountQueryOptions} query. */
export type GetVirtualAccountData = GetVirtualAccountReturnType;

/**
 * Build the TanStack Query key for {@link getVirtualAccountQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, account).
 * @returns A stable, hashable query key.
 */
export function getVirtualAccountQueryKey(
  options: Compute<ExactPartial<GetVirtualAccountParameters> & ConfigKeyParameter> = {},
) {
  return ["getVirtualAccount", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getVirtualAccountQueryKey}. */
export type GetVirtualAccountQueryKey = ReturnType<typeof getVirtualAccountQueryKey>;

/**
 * Options accepted by {@link getVirtualAccountQueryOptions}: the action's
 * parameters (all optional), an optional cache scope, and TanStack overrides.
 */
export type GetVirtualAccountOptions = Compute<
  ExactPartial<GetVirtualAccountParameters> &
    QueryParameter<GetVirtualAccountData, Error, GetVirtualAccountData, GetVirtualAccountQueryKey>
>;

/** TanStack Query options returned by {@link getVirtualAccountQueryOptions}. */
export type GetVirtualAccountQueryOptions = SymmioQueryOptions<
  GetVirtualAccountData,
  Error,
  GetVirtualAccountData,
  GetVirtualAccountQueryKey
>;

/**
 * Build TanStack Query options for {@link getVirtualAccount}. The query is
 * disabled until `account` is set. An unsupported chain surfaces a
 * {@link SymmError} from the query function (it is not silently disabled).
 *
 * The VA → `(symbolId, isolationType)` mapping is fixed at creation time, so
 * the caller can safely pass `query: { staleTime: Infinity }` to never refetch.
 *
 * @example
 * ```ts
 * useQuery(getVirtualAccountQueryOptions(config, { account: vaAddress, query: { staleTime: Infinity } }));
 * ```
 */
export function getVirtualAccountQueryOptions(
  config: Config,
  options: GetVirtualAccountOptions = {},
): GetVirtualAccountQueryOptions {
  return {
    ...options.query,
    queryKey: getVirtualAccountQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: Boolean(options.account) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, account } = options;
      if (!account) {
        throw new SymmError("validation", "MISSING_ACCOUNT", "getVirtualAccount: `account` is required.");
      }
      return getVirtualAccount(config, { chainId, account });
    },
  };
}
