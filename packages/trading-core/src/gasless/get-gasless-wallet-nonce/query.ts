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
 * An omitted `walletId` keys as `0n`, so `{ owner, account }` and
 * `{ owner, walletId: 0n, account }` share one cache entry — they read the same
 * nonce stream. `predicateMatch` compares only the fields its partial sets, so
 * `predicateMatch(getGaslessWalletNonceQueryKey, { account })` still matches the
 * account's nonce on every wallet.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 *
 * @example
 * ```ts
 * getGaslessWalletNonceQueryKey({ owner, account });
 * // → ["getGaslessWalletNonce", { owner, account, walletId: "0" }]
 * ```
 */
export function getGaslessWalletNonceQueryKey(
  options: Compute<ExactPartial<GetGaslessWalletNonceParameters> & ConfigKeyParameter> = {},
) {
  return ["getGaslessWalletNonce", filterQueryOptions({ ...options, walletId: options.walletId ?? 0n })] as const;
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
 * useQuery(getGaslessWalletNonceQueryOptions(config, { owner, walletId: 1n, account: subAccount }));
 * ```
 */
export function getGaslessWalletNonceQueryOptions(
  config: Config,
  options: GetGaslessWalletNonceOptions,
): GetGaslessWalletNonceQueryOptions {
  /** Every parameter reaches the action: a hand-listed subset would silently drop a new one, such as `walletId`. */
  const { query, ...parameters } = options;
  return {
    ...query,
    queryKey: getGaslessWalletNonceQueryKey({ ...parameters, configKey: config.getChainConfigKey(parameters.chainId) }),
    enabled: query?.enabled ?? true,
    queryFn: () => getGaslessWalletNonce(config, parameters),
  };
}
