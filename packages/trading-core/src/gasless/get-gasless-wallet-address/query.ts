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
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 */
export function getGaslessWalletAddressQueryKey(
  options: Compute<ExactPartial<GetGaslessWalletAddressParameters> & ConfigKeyParameter> = {},
) {
  return ["getGaslessWalletAddress", filterQueryOptions(options)] as const;
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
 * useQuery(getGaslessWalletAddressQueryOptions(config, { owner }));
 * ```
 */
export function getGaslessWalletAddressQueryOptions(
  config: Config,
  options: GetGaslessWalletAddressOptions,
): GetGaslessWalletAddressQueryOptions {
  return {
    ...options.query,
    queryKey: getGaslessWalletAddressQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => {
      const { chainId, owner } = options;
      return getGaslessWalletAddress(config, { chainId, owner });
    },
  };
}
