import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getMuonPriceRange,
  type GetMuonPriceRangeParameters,
  type GetMuonPriceRangeReturnType,
} from "./get-muon-price-range";

/** Data resolved by the {@link getMuonPriceRangeQueryOptions} query. */
export type GetMuonPriceRangeData = GetMuonPriceRangeReturnType;

/**
 * Build the TanStack Query key for {@link getMuonPriceRangeQueryOptions}.
 *
 * @param options - Query parameters (chain id, window, parties, symbol id).
 * @returns A stable, hashable query key.
 */
export function getMuonPriceRangeQueryKey(options: Compute<GetMuonPriceRangeParameters & ConfigKeyParameter>) {
  return ["getMuonPriceRange", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getMuonPriceRangeQueryKey}. */
export type GetMuonPriceRangeQueryKey = ReturnType<typeof getMuonPriceRangeQueryKey>;

/**
 * Options accepted by {@link getMuonPriceRangeQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetMuonPriceRangeOptions = Compute<
  GetMuonPriceRangeParameters &
    QueryParameter<GetMuonPriceRangeData, Error, GetMuonPriceRangeData, GetMuonPriceRangeQueryKey>
>;

/** TanStack Query options returned by {@link getMuonPriceRangeQueryOptions}. */
export type GetMuonPriceRangeQueryOptions = SymmioQueryOptions<
  GetMuonPriceRangeData,
  Error,
  GetMuonPriceRangeData,
  GetMuonPriceRangeQueryKey
>;

/**
 * Build TanStack Query options for {@link getMuonPriceRange}.
 *
 * @remarks
 * The attestation is short-lived. If you cache it — e.g. to display the attested
 * range — set a low `staleTime`; for a signature you intend to submit on-chain,
 * fetch a fresh one on demand instead of serving a cached one.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getMuonPriceRangeQueryOptions(config, {
 *     t0: 1_700_000_000n,
 *     t1: 1_700_000_900n,
 *     partyA: "0xva…",
 *     partyB: "0xpb…",
 *     symbolId: 1n,
 *   }),
 * );
 * ```
 */
export function getMuonPriceRangeQueryOptions(
  config: Config,
  options: GetMuonPriceRangeOptions,
): GetMuonPriceRangeQueryOptions {
  return {
    ...options.query,
    queryKey: getMuonPriceRangeQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getMuonPriceRange(config, {
        chainId: options.chainId,
        t0: options.t0,
        t1: options.t1,
        partyA: options.partyA,
        partyB: options.partyB,
        symbolId: options.symbolId,
      }),
  };
}
