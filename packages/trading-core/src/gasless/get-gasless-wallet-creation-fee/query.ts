import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getGaslessWalletCreationFee,
  type GetGaslessWalletCreationFeeParameters,
  type GetGaslessWalletCreationFeeReturnType,
} from "./get-gasless-wallet-creation-fee";

/** Data resolved by the {@link getGaslessWalletCreationFeeQueryOptions} query. */
export type GetGaslessWalletCreationFeeData = GetGaslessWalletCreationFeeReturnType;

/**
 * Build the TanStack Query key for {@link getGaslessWalletCreationFeeQueryOptions}.
 *
 * An omitted `walletId` keys as `0n`, so `{ owner }` and `{ owner, walletId: 0n }`
 * share one cache entry — they quote the same wallet. `predicateMatch` compares
 * only the fields its partial sets, so
 * `predicateMatch(getGaslessWalletCreationFeeQueryKey, { owner })` still matches
 * every wallet id of the owner.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 *
 * @example
 * ```ts
 * getGaslessWalletCreationFeeQueryKey({ owner, walletId: 1n });
 * // → ["getGaslessWalletCreationFee", { owner, walletId: "1" }]
 * ```
 */
export function getGaslessWalletCreationFeeQueryKey(
  options: Compute<ExactPartial<GetGaslessWalletCreationFeeParameters> & ConfigKeyParameter> = {},
) {
  return ["getGaslessWalletCreationFee", filterQueryOptions({ ...options, walletId: options.walletId ?? 0n })] as const;
}

/** Query-key type produced by {@link getGaslessWalletCreationFeeQueryKey}. */
export type GetGaslessWalletCreationFeeQueryKey = ReturnType<typeof getGaslessWalletCreationFeeQueryKey>;

/**
 * Options accepted by {@link getGaslessWalletCreationFeeQueryOptions}.
 */
export type GetGaslessWalletCreationFeeOptions = Compute<
  GetGaslessWalletCreationFeeParameters &
    QueryParameter<
      GetGaslessWalletCreationFeeData,
      Error,
      GetGaslessWalletCreationFeeData,
      GetGaslessWalletCreationFeeQueryKey
    >
>;

/** TanStack Query options returned by {@link getGaslessWalletCreationFeeQueryOptions}. */
export type GetGaslessWalletCreationFeeQueryOptions = SymmioQueryOptions<
  GetGaslessWalletCreationFeeData,
  Error,
  GetGaslessWalletCreationFeeData,
  GetGaslessWalletCreationFeeQueryKey
>;

/**
 * Build TanStack Query options for {@link getGaslessWalletCreationFee}.
 *
 * The fee drops to `0n` once any action deploys the wallet, so invalidate this
 * query after a settlement or wallet operation that may have deployed it — the
 * React relay hooks do.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getGaslessWalletCreationFeeQueryOptions(config, { owner, walletId: 1n }));
 * ```
 */
export function getGaslessWalletCreationFeeQueryOptions(
  config: Config,
  options: GetGaslessWalletCreationFeeOptions,
): GetGaslessWalletCreationFeeQueryOptions {
  /** Every parameter reaches the action: a hand-listed subset would silently drop a new one, such as `walletId`. */
  const { query, ...parameters } = options;
  return {
    ...query,
    queryKey: getGaslessWalletCreationFeeQueryKey({
      ...parameters,
      configKey: config.getChainConfigKey(parameters.chainId),
    }),
    enabled: query?.enabled ?? true,
    queryFn: () => getGaslessWalletCreationFee(config, parameters),
  };
}
