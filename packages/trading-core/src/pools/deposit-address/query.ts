import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getDepositAddress,
  type GetDepositAddressParameters,
  type GetDepositAddressReturnType,
} from "./get-deposit-address";

/** Data resolved by the {@link getDepositAddressQueryOptions} query. */
export type GetDepositAddressData = GetDepositAddressReturnType;

/**
 * Build the TanStack Query key for {@link getDepositAddressQueryOptions}.
 *
 * The bearer `accessToken` is dropped from the key by `filterQueryOptions` — it
 * is a credential, not a cache dimension, so two calls that differ only by a
 * refreshed token still hit the same cache entry (and the token never leaks into
 * a devtools-visible key).
 *
 * @param options - The action's parameters (including `accessToken`) plus the resolved config key.
 * @returns A stable, hashable query key.
 */
export function getDepositAddressQueryKey(options: Compute<GetDepositAddressParameters & ConfigKeyParameter>) {
  return ["getDepositAddress", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getDepositAddressQueryKey}. */
export type GetDepositAddressQueryKey = ReturnType<typeof getDepositAddressQueryKey>;

/**
 * Options accepted by {@link getDepositAddressQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetDepositAddressOptions = Compute<
  GetDepositAddressParameters &
    QueryParameter<GetDepositAddressData, Error, GetDepositAddressData, GetDepositAddressQueryKey>
>;

/** TanStack Query options returned by {@link getDepositAddressQueryOptions}. */
export type GetDepositAddressQueryOptions = SymmioQueryOptions<
  GetDepositAddressData,
  Error,
  GetDepositAddressData,
  GetDepositAddressQueryKey
>;

/**
 * Build TanStack Query options for {@link getDepositAddress}.
 *
 * The endpoint is a POST, but it is modeled as a query because it is an
 * idempotent get-or-create and the UI fetches it on market selection.
 *
 * @param config - The SDK config.
 * @param options - The action's parameters (including the required `accessToken`) and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getDepositAddressQueryOptions(config, {
 *     accessToken,
 *     tokenContractAddress: "0x1234…",
 *     depositChain: ListingDepositChainId.HYPER_EVM,
 *   }),
 * );
 * ```
 */
export function getDepositAddressQueryOptions(
  config: Config,
  options: GetDepositAddressOptions,
): GetDepositAddressQueryOptions {
  return {
    ...options.query,
    queryKey: getDepositAddressQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getDepositAddress(config, {
        chainId: options.chainId,
        accessToken: options.accessToken,
        tokenContractAddress: options.tokenContractAddress,
        depositChain: options.depositChain,
      }),
  };
}
