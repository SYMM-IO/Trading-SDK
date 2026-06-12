import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getMuonUpnlWithSymbolPrice,
  type GetMuonUpnlWithSymbolPriceParameters,
  type GetMuonUpnlWithSymbolPriceReturnType,
} from "./get-muon-upnl-with-symbol-price";

/** Data resolved by the {@link getMuonUpnlWithSymbolPriceQueryOptions} query. */
export type GetMuonUpnlWithSymbolPriceData = GetMuonUpnlWithSymbolPriceReturnType;

/**
 * Build the TanStack Query key for {@link getMuonUpnlWithSymbolPriceQueryOptions}.
 *
 * @param options - Query parameters (chain id, partyB, partyA, symbolId).
 * @returns A stable, hashable query key.
 */
export function getMuonUpnlWithSymbolPriceQueryKey(
  options: Compute<GetMuonUpnlWithSymbolPriceParameters & ConfigKeyParameter>,
) {
  return ["getMuonUpnlWithSymbolPrice", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getMuonUpnlWithSymbolPriceQueryKey}. */
export type GetMuonUpnlWithSymbolPriceQueryKey = ReturnType<typeof getMuonUpnlWithSymbolPriceQueryKey>;

/**
 * Options accepted by {@link getMuonUpnlWithSymbolPriceQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetMuonUpnlWithSymbolPriceOptions = Compute<
  GetMuonUpnlWithSymbolPriceParameters &
    QueryParameter<
      GetMuonUpnlWithSymbolPriceData,
      Error,
      GetMuonUpnlWithSymbolPriceData,
      GetMuonUpnlWithSymbolPriceQueryKey
    >
>;

/** TanStack Query options returned by {@link getMuonUpnlWithSymbolPriceQueryOptions}. */
export type GetMuonUpnlWithSymbolPriceQueryOptions = SymmioQueryOptions<
  GetMuonUpnlWithSymbolPriceData,
  Error,
  GetMuonUpnlWithSymbolPriceData,
  GetMuonUpnlWithSymbolPriceQueryKey
>;

/**
 * Build TanStack Query options for {@link getMuonUpnlWithSymbolPrice}.
 *
 * @remarks
 * The attestation is short-lived. If you cache it — e.g. to display the attested
 * price/uPnL — set a low `staleTime`; for a signature you intend to submit
 * on-chain, fetch a fresh one on demand instead of serving a cached one.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getMuonUpnlWithSymbolPriceQueryOptions(config, {
 *     partyB: "0xsolver…",
 *     partyA: "0xva…",
 *     symbolId: 1n,
 *   }),
 * );
 * ```
 */
export function getMuonUpnlWithSymbolPriceQueryOptions(
  config: Config,
  options: GetMuonUpnlWithSymbolPriceOptions,
): GetMuonUpnlWithSymbolPriceQueryOptions {
  return {
    ...options.query,
    queryKey: getMuonUpnlWithSymbolPriceQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getMuonUpnlWithSymbolPrice(config, {
        chainId: options.chainId,
        partyB: options.partyB,
        partyA: options.partyA,
        symbolId: options.symbolId,
      }),
  };
}
