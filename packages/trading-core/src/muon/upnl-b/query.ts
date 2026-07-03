import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getMuonUpnlB, type GetMuonUpnlBParameters, type GetMuonUpnlBReturnType } from "./get-muon-upnl-b";

/** Data resolved by the {@link getMuonUpnlBQueryOptions} query. */
export type GetMuonUpnlBData = GetMuonUpnlBReturnType;

/**
 * Build the TanStack Query key for {@link getMuonUpnlBQueryOptions}.
 *
 * @param options - Query parameters (chain id, partyB, partyA).
 * @returns A stable, hashable query key.
 */
export function getMuonUpnlBQueryKey(options: Compute<GetMuonUpnlBParameters & ConfigKeyParameter>) {
  return ["getMuonUpnlB", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getMuonUpnlBQueryKey}. */
export type GetMuonUpnlBQueryKey = ReturnType<typeof getMuonUpnlBQueryKey>;

/**
 * Options accepted by {@link getMuonUpnlBQueryOptions}: the action's parameters,
 * an optional cache scope, and TanStack overrides.
 */
export type GetMuonUpnlBOptions = Compute<
  GetMuonUpnlBParameters & QueryParameter<GetMuonUpnlBData, Error, GetMuonUpnlBData, GetMuonUpnlBQueryKey>
>;

/** TanStack Query options returned by {@link getMuonUpnlBQueryOptions}. */
export type GetMuonUpnlBQueryOptions = SymmioQueryOptions<
  GetMuonUpnlBData,
  Error,
  GetMuonUpnlBData,
  GetMuonUpnlBQueryKey
>;

/**
 * Build TanStack Query options for {@link getMuonUpnlB}.
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
 * useQuery(getMuonUpnlBQueryOptions(config, { partyB: "0xpb…", partyA: "0xva…" }));
 * ```
 */
export function getMuonUpnlBQueryOptions(config: Config, options: GetMuonUpnlBOptions): GetMuonUpnlBQueryOptions {
  return {
    ...options.query,
    queryKey: getMuonUpnlBQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getMuonUpnlB(config, { chainId: options.chainId, partyB: options.partyB, partyA: options.partyA }),
  };
}
