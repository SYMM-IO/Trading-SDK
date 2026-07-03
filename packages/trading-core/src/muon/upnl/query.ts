import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getMuonUpnl, type GetMuonUpnlParameters, type GetMuonUpnlReturnType } from "./get-muon-upnl";

/** Data resolved by the {@link getMuonUpnlQueryOptions} query. */
export type GetMuonUpnlData = GetMuonUpnlReturnType;

/**
 * Build the TanStack Query key for {@link getMuonUpnlQueryOptions}.
 *
 * @param options - Query parameters (chain id, partyB, partyA).
 * @returns A stable, hashable query key.
 */
export function getMuonUpnlQueryKey(options: Compute<GetMuonUpnlParameters & ConfigKeyParameter>) {
  return ["getMuonUpnl", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getMuonUpnlQueryKey}. */
export type GetMuonUpnlQueryKey = ReturnType<typeof getMuonUpnlQueryKey>;

/**
 * Options accepted by {@link getMuonUpnlQueryOptions}: the action's parameters,
 * an optional cache scope, and TanStack overrides.
 */
export type GetMuonUpnlOptions = Compute<
  GetMuonUpnlParameters & QueryParameter<GetMuonUpnlData, Error, GetMuonUpnlData, GetMuonUpnlQueryKey>
>;

/** TanStack Query options returned by {@link getMuonUpnlQueryOptions}. */
export type GetMuonUpnlQueryOptions = SymmioQueryOptions<GetMuonUpnlData, Error, GetMuonUpnlData, GetMuonUpnlQueryKey>;

/**
 * Build TanStack Query options for {@link getMuonUpnl}.
 *
 * @remarks
 * The attestation is short-lived. If you cache it — e.g. to display the attested
 * uPnL — set a low `staleTime`; for a signature you intend to submit on-chain,
 * fetch a fresh one on demand instead of serving a cached one.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getMuonUpnlQueryOptions(config, { partyB: "0xb…", partyA: "0xva…" }));
 * ```
 */
export function getMuonUpnlQueryOptions(config: Config, options: GetMuonUpnlOptions): GetMuonUpnlQueryOptions {
  return {
    ...options.query,
    queryKey: getMuonUpnlQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getMuonUpnl(config, { chainId: options.chainId, partyB: options.partyB, partyA: options.partyA }),
  };
}
