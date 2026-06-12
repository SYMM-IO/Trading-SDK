import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getMuonSettleUpnl,
  type GetMuonSettleUpnlParameters,
  type GetMuonSettleUpnlReturnType,
} from "./get-muon-settle-upnl";

/** Data resolved by the {@link getMuonSettleUpnlQueryOptions} query. */
export type GetMuonSettleUpnlData = GetMuonSettleUpnlReturnType;

/**
 * Build the TanStack Query key for {@link getMuonSettleUpnlQueryOptions}.
 *
 * @param options - Query parameters (chain id, partyA, quote ids).
 * @returns A stable, hashable query key.
 */
export function getMuonSettleUpnlQueryKey(options: Compute<GetMuonSettleUpnlParameters & ConfigKeyParameter>) {
  return ["getMuonSettleUpnl", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getMuonSettleUpnlQueryKey}. */
export type GetMuonSettleUpnlQueryKey = ReturnType<typeof getMuonSettleUpnlQueryKey>;

/**
 * Options accepted by {@link getMuonSettleUpnlQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetMuonSettleUpnlOptions = Compute<
  GetMuonSettleUpnlParameters &
    QueryParameter<GetMuonSettleUpnlData, Error, GetMuonSettleUpnlData, GetMuonSettleUpnlQueryKey>
>;

/** TanStack Query options returned by {@link getMuonSettleUpnlQueryOptions}. */
export type GetMuonSettleUpnlQueryOptions = SymmioQueryOptions<
  GetMuonSettleUpnlData,
  Error,
  GetMuonSettleUpnlData,
  GetMuonSettleUpnlQueryKey
>;

/**
 * Build TanStack Query options for {@link getMuonSettleUpnl}.
 *
 * @remarks
 * The attestation is short-lived. If you cache it — e.g. to display the settled
 * uPnL — set a low `staleTime`; for a signature you intend to submit on-chain,
 * fetch a fresh one on demand instead of serving a cached one.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getMuonSettleUpnlQueryOptions(config, { partyA: "0xva…", quoteIds: [10n] }));
 * ```
 */
export function getMuonSettleUpnlQueryOptions(
  config: Config,
  options: GetMuonSettleUpnlOptions,
): GetMuonSettleUpnlQueryOptions {
  return {
    ...options.query,
    queryKey: getMuonSettleUpnlQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getMuonSettleUpnl(config, { chainId: options.chainId, partyA: options.partyA, quoteIds: options.quoteIds }),
  };
}
