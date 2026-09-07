import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getInstantLayerNonce,
  type GetInstantLayerNonceParameters,
  type GetInstantLayerNonceReturnType,
} from "../actions/get-instant-layer-nonce";

/** Data resolved by the {@link getInstantLayerNonceQueryOptions} query. */
export type GetInstantLayerNonceData = GetInstantLayerNonceReturnType;

/**
 * Build the TanStack Query key for {@link getInstantLayerNonceQueryOptions}.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 */
export function getInstantLayerNonceQueryKey(
  options: Compute<ExactPartial<GetInstantLayerNonceParameters> & ConfigKeyParameter> = {},
) {
  return ["getInstantLayerNonce", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getInstantLayerNonceQueryKey}. */
export type GetInstantLayerNonceQueryKey = ReturnType<typeof getInstantLayerNonceQueryKey>;

/**
 * Options accepted by {@link getInstantLayerNonceQueryOptions}: the action's
 * required read parameters, an optional chain id, and TanStack overrides.
 */
export type GetInstantLayerNonceOptions = Compute<
  GetInstantLayerNonceParameters &
    QueryParameter<GetInstantLayerNonceData, Error, GetInstantLayerNonceData, GetInstantLayerNonceQueryKey>
>;

/** TanStack Query options returned by {@link getInstantLayerNonceQueryOptions}. */
export type GetInstantLayerNonceQueryOptions = SymmioQueryOptions<
  GetInstantLayerNonceData,
  Error,
  GetInstantLayerNonceData,
  GetInstantLayerNonceQueryKey
>;

/**
 * Build TanStack Query options for {@link getInstantLayerNonce}.
 *
 * A cached nonce is only a display value — a write path must call
 * {@link getInstantLayerNonce} directly right before signing.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getInstantLayerNonceQueryOptions(config, { account }));
 * ```
 */
export function getInstantLayerNonceQueryOptions(
  config: Config,
  options: GetInstantLayerNonceOptions,
): GetInstantLayerNonceQueryOptions {
  return {
    ...options.query,
    queryKey: getInstantLayerNonceQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => {
      const { chainId, account } = options;
      return getInstantLayerNonce(config, { chainId, account });
    },
  };
}
