import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getGaslessDepositPolicy,
  type GetGaslessDepositPolicyParameters,
  type GetGaslessDepositPolicyReturnType,
} from "./get-gasless-deposit-policy";

/** Data resolved by the {@link getGaslessDepositPolicyQueryOptions} query. */
export type GetGaslessDepositPolicyData = GetGaslessDepositPolicyReturnType;

/**
 * Build the TanStack Query key for {@link getGaslessDepositPolicyQueryOptions}.
 *
 * An omitted `walletId` keys as `0n`, so `{ owner }` and `{ owner, walletId: 0n }`
 * share one cache entry — they read the same wallet's policy. `predicateMatch`
 * compares only the fields its partial sets, so
 * `predicateMatch(getGaslessDepositPolicyQueryKey, { owner })` still matches every
 * wallet id of the owner.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 *
 * @example
 * ```ts
 * getGaslessDepositPolicyQueryKey({ owner });
 * // → ["getGaslessDepositPolicy", { owner, walletId: "0" }]
 * ```
 */
export function getGaslessDepositPolicyQueryKey(
  options: Compute<ExactPartial<GetGaslessDepositPolicyParameters> & ConfigKeyParameter> = {},
) {
  return ["getGaslessDepositPolicy", filterQueryOptions({ ...options, walletId: options.walletId ?? 0n })] as const;
}

/** Query-key type produced by {@link getGaslessDepositPolicyQueryKey}. */
export type GetGaslessDepositPolicyQueryKey = ReturnType<typeof getGaslessDepositPolicyQueryKey>;

/**
 * Options accepted by {@link getGaslessDepositPolicyQueryOptions}.
 */
export type GetGaslessDepositPolicyOptions = Compute<
  GetGaslessDepositPolicyParameters &
    QueryParameter<GetGaslessDepositPolicyData, Error, GetGaslessDepositPolicyData, GetGaslessDepositPolicyQueryKey>
>;

/** TanStack Query options returned by {@link getGaslessDepositPolicyQueryOptions}. */
export type GetGaslessDepositPolicyQueryOptions = SymmioQueryOptions<
  GetGaslessDepositPolicyData,
  Error,
  GetGaslessDepositPolicyData,
  GetGaslessDepositPolicyQueryKey
>;

/**
 * Build TanStack Query options for {@link getGaslessDepositPolicy}.
 *
 * The policy carries the wallet's creation fee, which drops to `0n` once any
 * action deploys the wallet, so invalidate this query after a settlement or
 * wallet operation — the React relay hooks do.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getGaslessDepositPolicyQueryOptions(config, { owner, walletId: 1n }));
 * ```
 */
export function getGaslessDepositPolicyQueryOptions(
  config: Config,
  options: GetGaslessDepositPolicyOptions,
): GetGaslessDepositPolicyQueryOptions {
  /** Every parameter reaches the action: a hand-listed subset would silently drop a new one, such as `walletId`. */
  const { query, ...parameters } = options;
  return {
    ...query,
    queryKey: getGaslessDepositPolicyQueryKey({
      ...parameters,
      configKey: config.getChainConfigKey(parameters.chainId),
    }),
    enabled: query?.enabled ?? true,
    queryFn: () => getGaslessDepositPolicy(config, parameters),
  };
}
