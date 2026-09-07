import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getGaslessWalletNonce,
  type GetGaslessWalletNonceParameters,
  type GetGaslessWalletNonceReturnType,
} from "./get-gasless-wallet-nonce";

/** Data resolved by the {@link getGaslessWalletNonceQueryOptions} query. */
export type GetGaslessWalletNonceData = GetGaslessWalletNonceReturnType;

/**
 * Build the TanStack Query key for {@link getGaslessWalletNonceQueryOptions}.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 */
export function getGaslessWalletNonceQueryKey(
  options: Compute<ExactPartial<GetGaslessWalletNonceParameters> & ConfigKeyParameter> = {},
) {
  return ["getGaslessWalletNonce", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getGaslessWalletNonceQueryKey}. */
export type GetGaslessWalletNonceQueryKey = ReturnType<typeof getGaslessWalletNonceQueryKey>;

/**
 * Options accepted by {@link getGaslessWalletNonceQueryOptions}.
 */
export type GetGaslessWalletNonceOptions = Compute<
  GetGaslessWalletNonceParameters &
    QueryParameter<GetGaslessWalletNonceData, Error, GetGaslessWalletNonceData, GetGaslessWalletNonceQueryKey>
>;

/** TanStack Query options returned by {@link getGaslessWalletNonceQueryOptions}. */
export type GetGaslessWalletNonceQueryOptions = SymmioQueryOptions<
  GetGaslessWalletNonceData,
  Error,
  GetGaslessWalletNonceData,
  GetGaslessWalletNonceQueryKey
>;

/**
 * Build TanStack Query options for {@link getGaslessWalletNonce}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getGaslessWalletNonceQueryOptions(config, { account }));
 * ```
 */
export function getGaslessWalletNonceQueryOptions(
  config: Config,
  options: GetGaslessWalletNonceOptions,
): GetGaslessWalletNonceQueryOptions {
  return {
    ...options.query,
    queryKey: getGaslessWalletNonceQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => {
      const { chainId, account } = options;
      return getGaslessWalletNonce(config, { chainId, account });
    },
  };
}
