import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getMuonUpnlA, type GetMuonUpnlAParameters, type GetMuonUpnlAReturnType } from "./get-muon-upnl-a";

/** Data resolved by the {@link getMuonUpnlAQueryOptions} query. */
export type GetMuonUpnlAData = GetMuonUpnlAReturnType;

/**
 * Build the TanStack Query key for {@link getMuonUpnlAQueryOptions}.
 *
 * @param options - Query parameters (chain id, partyA).
 * @returns A stable, hashable query key.
 */
export function getMuonUpnlAQueryKey(options: Compute<GetMuonUpnlAParameters & ConfigKeyParameter>) {
  return ["getMuonUpnlA", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getMuonUpnlAQueryKey}. */
export type GetMuonUpnlAQueryKey = ReturnType<typeof getMuonUpnlAQueryKey>;

/**
 * Options accepted by {@link getMuonUpnlAQueryOptions}: the action's parameters,
 * an optional cache scope, and TanStack overrides.
 */
export type GetMuonUpnlAOptions = Compute<
  GetMuonUpnlAParameters & QueryParameter<GetMuonUpnlAData, Error, GetMuonUpnlAData, GetMuonUpnlAQueryKey>
>;

/** TanStack Query options returned by {@link getMuonUpnlAQueryOptions}. */
export type GetMuonUpnlAQueryOptions = SymmioQueryOptions<
  GetMuonUpnlAData,
  Error,
  GetMuonUpnlAData,
  GetMuonUpnlAQueryKey
>;

/**
 * Build TanStack Query options for {@link getMuonUpnlA}.
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
 * useQuery(getMuonUpnlAQueryOptions(config, { partyA: "0xva…" }));
 * ```
 */
export function getMuonUpnlAQueryOptions(config: Config, options: GetMuonUpnlAOptions): GetMuonUpnlAQueryOptions {
  return {
    ...options.query,
    queryKey: getMuonUpnlAQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getMuonUpnlA(config, { chainId: options.chainId, partyA: options.partyA }),
  };
}
