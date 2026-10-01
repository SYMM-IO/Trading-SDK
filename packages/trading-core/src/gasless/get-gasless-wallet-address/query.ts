import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getGaslessWalletAddress,
  type GetGaslessWalletAddressParameters,
  type GetGaslessWalletAddressReturnType,
} from "./get-gasless-wallet-address";

/** Data resolved by the {@link getGaslessWalletAddressQueryOptions} query. */
export type GetGaslessWalletAddressData = GetGaslessWalletAddressReturnType;

/**
 * Build the TanStack Query key for {@link getGaslessWalletAddressQueryOptions}.
 *
 * An omitted `walletId` keys as `0n`, so `{ owner }` and `{ owner, walletId: 0n }`
 * share one cache entry — they read the same wallet. `predicateMatch` compares
 * only the fields its partial sets, so `predicateMatch(getGaslessWalletAddressQueryKey, { owner })`
 * still matches every wallet id of the owner.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 *
 * @example
 * ```ts
 * getGaslessWalletAddressQueryKey({ owner });
 * // → ["getGaslessWalletAddress", { owner, walletId: "0" }]
 * ```
 */
export function getGaslessWalletAddressQueryKey(
  options: Compute<ExactPartial<GetGaslessWalletAddressParameters> & ConfigKeyParameter> = {},
) {
  return ["getGaslessWalletAddress", filterQueryOptions({ ...options, walletId: options.walletId ?? 0n })] as const;
}

/** Query-key type produced by {@link getGaslessWalletAddressQueryKey}. */
export type GetGaslessWalletAddressQueryKey = ReturnType<typeof getGaslessWalletAddressQueryKey>;

/**
 * Options accepted by {@link getGaslessWalletAddressQueryOptions}.
 */
export type GetGaslessWalletAddressOptions = Compute<
  GetGaslessWalletAddressParameters &
    QueryParameter<GetGaslessWalletAddressData, Error, GetGaslessWalletAddressData, GetGaslessWalletAddressQueryKey>
>;

/** TanStack Query options returned by {@link getGaslessWalletAddressQueryOptions}. */
export type GetGaslessWalletAddressQueryOptions = SymmioQueryOptions<
  GetGaslessWalletAddressData,
  Error,
  GetGaslessWalletAddressData,
  GetGaslessWalletAddressQueryKey
>;

/**
 * Build TanStack Query options for {@link getGaslessWalletAddress}.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getGaslessWalletAddressQueryOptions(config, { owner, walletId: 1n }));
 * ```
 */
export function getGaslessWalletAddressQueryOptions(
  config: Config,
  options: GetGaslessWalletAddressOptions,
): GetGaslessWalletAddressQueryOptions {
  /** Every parameter reaches the action: a hand-listed subset would silently drop a new one, such as `walletId`. */
  const { query, ...parameters } = options;
  return {
    ...query,
    queryKey: getGaslessWalletAddressQueryKey({
      ...parameters,
      configKey: config.getChainConfigKey(parameters.chainId),
    }),
    enabled: query?.enabled ?? true,
    queryFn: () => getGaslessWalletAddress(config, parameters),
  };
}
