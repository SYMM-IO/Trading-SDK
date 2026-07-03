import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getMuonPartyAOverview,
  type GetMuonPartyAOverviewParameters,
  type GetMuonPartyAOverviewReturnType,
} from "./get-muon-party-a-overview";

/** Data resolved by the {@link getMuonPartyAOverviewQueryOptions} query. */
export type GetMuonPartyAOverviewData = GetMuonPartyAOverviewReturnType;

/**
 * Build the TanStack Query key for {@link getMuonPartyAOverviewQueryOptions}.
 *
 * @param options - Query parameters (chain id, partyA).
 * @returns A stable, hashable query key.
 */
export function getMuonPartyAOverviewQueryKey(options: Compute<GetMuonPartyAOverviewParameters & ConfigKeyParameter>) {
  return ["getMuonPartyAOverview", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getMuonPartyAOverviewQueryKey}. */
export type GetMuonPartyAOverviewQueryKey = ReturnType<typeof getMuonPartyAOverviewQueryKey>;

/**
 * Options accepted by {@link getMuonPartyAOverviewQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetMuonPartyAOverviewOptions = Compute<
  GetMuonPartyAOverviewParameters &
    QueryParameter<GetMuonPartyAOverviewData, Error, GetMuonPartyAOverviewData, GetMuonPartyAOverviewQueryKey>
>;

/** TanStack Query options returned by {@link getMuonPartyAOverviewQueryOptions}. */
export type GetMuonPartyAOverviewQueryOptions = SymmioQueryOptions<
  GetMuonPartyAOverviewData,
  Error,
  GetMuonPartyAOverviewData,
  GetMuonPartyAOverviewQueryKey
>;

/**
 * Build TanStack Query options for {@link getMuonPartyAOverview}.
 *
 * @remarks
 * The attestation is short-lived. If you cache it — e.g. to display the attested
 * liquidation overview — set a low `staleTime`; for a signature you intend to
 * submit on-chain, fetch a fresh one on demand instead of serving a cached one.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getMuonPartyAOverviewQueryOptions(config, { partyA: "0xva…" }));
 * ```
 */
export function getMuonPartyAOverviewQueryOptions(
  config: Config,
  options: GetMuonPartyAOverviewOptions,
): GetMuonPartyAOverviewQueryOptions {
  return {
    ...options.query,
    queryKey: getMuonPartyAOverviewQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getMuonPartyAOverview(config, { chainId: options.chainId, partyA: options.partyA }),
  };
}
