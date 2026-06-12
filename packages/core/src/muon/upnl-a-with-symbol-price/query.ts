import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getMuonUpnlAWithSymbolPrice,
  type GetMuonUpnlAWithSymbolPriceParameters,
  type GetMuonUpnlAWithSymbolPriceReturnType,
} from "./get-muon-upnl-a-with-symbol-price";

/** Data resolved by the {@link getMuonUpnlAWithSymbolPriceQueryOptions} query. */
export type GetMuonUpnlAWithSymbolPriceData = GetMuonUpnlAWithSymbolPriceReturnType;

/**
 * Build the TanStack Query key for {@link getMuonUpnlAWithSymbolPriceQueryOptions}.
 *
 * @param options - Query parameters (chain id, partyA, symbolId).
 * @returns A stable, hashable query key.
 */
export function getMuonUpnlAWithSymbolPriceQueryKey(
  options: Compute<GetMuonUpnlAWithSymbolPriceParameters & ConfigKeyParameter>,
) {
  return ["getMuonUpnlAWithSymbolPrice", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getMuonUpnlAWithSymbolPriceQueryKey}. */
export type GetMuonUpnlAWithSymbolPriceQueryKey = ReturnType<typeof getMuonUpnlAWithSymbolPriceQueryKey>;

/**
 * Options accepted by {@link getMuonUpnlAWithSymbolPriceQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetMuonUpnlAWithSymbolPriceOptions = Compute<
  GetMuonUpnlAWithSymbolPriceParameters &
    QueryParameter<
      GetMuonUpnlAWithSymbolPriceData,
      Error,
      GetMuonUpnlAWithSymbolPriceData,
      GetMuonUpnlAWithSymbolPriceQueryKey
    >
>;

/** TanStack Query options returned by {@link getMuonUpnlAWithSymbolPriceQueryOptions}. */
export type GetMuonUpnlAWithSymbolPriceQueryOptions = SymmioQueryOptions<
  GetMuonUpnlAWithSymbolPriceData,
  Error,
  GetMuonUpnlAWithSymbolPriceData,
  GetMuonUpnlAWithSymbolPriceQueryKey
>;

/**
 * Build TanStack Query options for {@link getMuonUpnlAWithSymbolPrice}.
 *
 * @remarks
 * The attestation is short-lived. If you cache it — e.g. to display the attested
 * uPnL and price — set a low `staleTime`; for a signature you intend to submit
 * on-chain, fetch a fresh one on demand instead of serving a cached one.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getMuonUpnlAWithSymbolPriceQueryOptions(config, { partyA: "0xva…", symbolId: 1n }));
 * ```
 */
export function getMuonUpnlAWithSymbolPriceQueryOptions(
  config: Config,
  options: GetMuonUpnlAWithSymbolPriceOptions,
): GetMuonUpnlAWithSymbolPriceQueryOptions {
  return {
    ...options.query,
    queryKey: getMuonUpnlAWithSymbolPriceQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getMuonUpnlAWithSymbolPrice(config, {
        chainId: options.chainId,
        partyA: options.partyA,
        symbolId: options.symbolId,
      }),
  };
}
