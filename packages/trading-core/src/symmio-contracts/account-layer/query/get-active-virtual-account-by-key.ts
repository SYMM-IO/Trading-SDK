import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getActiveVirtualAccountByKey,
  type GetActiveVirtualAccountByKeyParameters,
  type GetActiveVirtualAccountByKeyReturnType,
} from "../actions/get-active-virtual-account-by-key";

/** Data resolved by the {@link getActiveVirtualAccountByKeyQueryOptions} query. */
export type GetActiveVirtualAccountByKeyData = GetActiveVirtualAccountByKeyReturnType;

/**
 * Build the TanStack Query key for {@link getActiveVirtualAccountByKeyQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, subAccount, isolation type, symbol id).
 * @returns A stable, hashable query key.
 */
export function getActiveVirtualAccountByKeyQueryKey(
  options: Compute<ExactPartial<GetActiveVirtualAccountByKeyParameters> & ConfigKeyParameter> = {},
) {
  return ["getActiveVirtualAccountByKey", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getActiveVirtualAccountByKeyQueryKey}. */
export type GetActiveVirtualAccountByKeyQueryKey = ReturnType<typeof getActiveVirtualAccountByKeyQueryKey>;

/**
 * Options accepted by {@link getActiveVirtualAccountByKeyQueryOptions}: the
 * action's parameters (all optional), an optional cache scope, and TanStack
 * overrides.
 */
export type GetActiveVirtualAccountByKeyOptions = Compute<
  ExactPartial<GetActiveVirtualAccountByKeyParameters> &
    QueryParameter<
      GetActiveVirtualAccountByKeyData,
      Error,
      GetActiveVirtualAccountByKeyData,
      GetActiveVirtualAccountByKeyQueryKey
    >
>;

/** TanStack Query options returned by {@link getActiveVirtualAccountByKeyQueryOptions}. */
export type GetActiveVirtualAccountByKeyQueryOptions = SymmioQueryOptions<
  GetActiveVirtualAccountByKeyData,
  Error,
  GetActiveVirtualAccountByKeyData,
  GetActiveVirtualAccountByKeyQueryKey
>;

/**
 * Build TanStack Query options for {@link getActiveVirtualAccountByKey}. The
 * query is disabled until `subAccount`, `isolationType` and `symbolId` are all
 * set. An unsupported chain surfaces a {@link SymmError} from the query function
 * (it is not silently disabled).
 *
 * The active VA changes when a position on the key opens or fully closes, so
 * invalidate the query after those writes rather than caching it forever.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getActiveVirtualAccountByKeyQueryOptions(config, { subAccount, isolationType, symbolId, chainId }));
 * ```
 */
export function getActiveVirtualAccountByKeyQueryOptions(
  config: Config,
  options: GetActiveVirtualAccountByKeyOptions = {},
): GetActiveVirtualAccountByKeyQueryOptions {
  return {
    ...options.query,
    queryKey: getActiveVirtualAccountByKeyQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled:
      Boolean(options.subAccount) &&
      options.isolationType !== undefined &&
      options.symbolId !== undefined &&
      (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, subAccount, isolationType, symbolId } = options;
      if (!subAccount || isolationType === undefined || symbolId === undefined) {
        throw new SymmError(
          "validation",
          "MISSING_ACTIVE_VA_INPUTS",
          "getActiveVirtualAccountByKey: `subAccount`, `isolationType`, and `symbolId` are required.",
        );
      }
      return getActiveVirtualAccountByKey(config, { chainId, subAccount, isolationType, symbolId });
    },
  };
}
