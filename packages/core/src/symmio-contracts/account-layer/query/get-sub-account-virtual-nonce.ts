import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ExactPartial, ScopeKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getSubAccountVirtualNonce,
  type GetSubAccountVirtualNonceParameters,
  type GetSubAccountVirtualNonceReturnType,
} from "../actions/get-sub-account-virtual-nonce";

/** Data resolved by the {@link getSubAccountVirtualNonceQueryOptions} query. */
export type GetSubAccountVirtualNonceData = GetSubAccountVirtualNonceReturnType;

/**
 * Build the TanStack Query key for {@link getSubAccountVirtualNonceQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, subAccount).
 * @returns A stable, hashable query key.
 */
export function getSubAccountVirtualNonceQueryKey(
  options: Compute<ExactPartial<GetSubAccountVirtualNonceParameters> & ScopeKeyParameter> = {},
) {
  return ["getSubAccountVirtualNonce", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSubAccountVirtualNonceQueryKey}. */
export type GetSubAccountVirtualNonceQueryKey = ReturnType<typeof getSubAccountVirtualNonceQueryKey>;

/**
 * Options accepted by {@link getSubAccountVirtualNonceQueryOptions}: the action's
 * parameters (all optional), an optional cache scope, and TanStack overrides.
 */
export type GetSubAccountVirtualNonceOptions = Compute<
  ExactPartial<GetSubAccountVirtualNonceParameters> &
    ScopeKeyParameter &
    QueryParameter<
      GetSubAccountVirtualNonceData,
      Error,
      GetSubAccountVirtualNonceData,
      GetSubAccountVirtualNonceQueryKey
    >
>;

/** TanStack Query options returned by {@link getSubAccountVirtualNonceQueryOptions}. */
export type GetSubAccountVirtualNonceQueryOptions = SymmioQueryOptions<
  GetSubAccountVirtualNonceData,
  Error,
  GetSubAccountVirtualNonceData,
  GetSubAccountVirtualNonceQueryKey
>;

/**
 * Build TanStack Query options for {@link getSubAccountVirtualNonce}. The query is
 * disabled until `subAccount` is set. An unsupported chain surfaces a
 * {@link SymmError} from the query function (it is not silently disabled).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getSubAccountVirtualNonceQueryOptions(config, { subAccount, chainId }));
 * ```
 */
export function getSubAccountVirtualNonceQueryOptions(
  config: Config,
  options: GetSubAccountVirtualNonceOptions = {},
): GetSubAccountVirtualNonceQueryOptions {
  return {
    ...options.query,
    queryKey: getSubAccountVirtualNonceQueryKey(options),
    enabled: Boolean(options.subAccount) && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, subAccount } = options;
      if (!subAccount) {
        throw new SymmError("validation", "MISSING_SUB_ACCOUNT", "getSubAccountVirtualNonce: `subAccount` is required.");
      }
      return getSubAccountVirtualNonce(config, { chainId, subAccount });
    },
  };
}
