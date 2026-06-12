import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getMuonPrice, type GetMuonPriceParameters, type GetMuonPriceReturnType } from "./get-muon-price";

/** Data resolved by the {@link getMuonPriceQueryOptions} query. */
export type GetMuonPriceData = GetMuonPriceReturnType;

/**
 * Build the TanStack Query key for {@link getMuonPriceQueryOptions}.
 *
 * @param options - Query parameters (chain id, quote ids).
 * @returns A stable, hashable query key.
 */
export function getMuonPriceQueryKey(options: Compute<GetMuonPriceParameters & ConfigKeyParameter>) {
  return ["getMuonPrice", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getMuonPriceQueryKey}. */
export type GetMuonPriceQueryKey = ReturnType<typeof getMuonPriceQueryKey>;

/**
 * Options accepted by {@link getMuonPriceQueryOptions}: the action's parameters,
 * an optional cache scope, and TanStack overrides.
 */
export type GetMuonPriceOptions = Compute<
  GetMuonPriceParameters & QueryParameter<GetMuonPriceData, Error, GetMuonPriceData, GetMuonPriceQueryKey>
>;

/** TanStack Query options returned by {@link getMuonPriceQueryOptions}. */
export type GetMuonPriceQueryOptions = SymmioQueryOptions<
  GetMuonPriceData,
  Error,
  GetMuonPriceData,
  GetMuonPriceQueryKey
>;

/**
 * Build TanStack Query options for {@link getMuonPrice}.
 *
 * @remarks
 * The attestation is short-lived. If you cache it — e.g. to display the validated
 * prices — set a low `staleTime`; for a signature you intend to submit on-chain,
 * fetch a fresh one on demand instead of serving a cached one.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getMuonPriceQueryOptions(config, { quoteIds: [10n, 11n] }));
 * ```
 */
export function getMuonPriceQueryOptions(config: Config, options: GetMuonPriceOptions): GetMuonPriceQueryOptions {
  return {
    ...options.query,
    queryKey: getMuonPriceQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getMuonPrice(config, { chainId: options.chainId, quoteIds: options.quoteIds }),
  };
}
