import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getDeallocateUpnlSig,
  type GetDeallocateUpnlSigParameters,
  type GetDeallocateUpnlSigReturnType,
} from "./get-deallocate-upnl-sig";

/** Data resolved by the {@link getDeallocateUpnlSigQueryOptions} query. */
export type GetDeallocateUpnlSigData = GetDeallocateUpnlSigReturnType;

/**
 * Build the TanStack Query key for {@link getDeallocateUpnlSigQueryOptions}.
 *
 * @param options - Query parameters (chain id, virtual account).
 * @returns A stable, hashable query key.
 */
export function getDeallocateUpnlSigQueryKey(options: Compute<GetDeallocateUpnlSigParameters & ConfigKeyParameter>) {
  return ["getDeallocateUpnlSig", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getDeallocateUpnlSigQueryKey}. */
export type GetDeallocateUpnlSigQueryKey = ReturnType<typeof getDeallocateUpnlSigQueryKey>;

/**
 * Options accepted by {@link getDeallocateUpnlSigQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetDeallocateUpnlSigOptions = Compute<
  GetDeallocateUpnlSigParameters &
    QueryParameter<GetDeallocateUpnlSigData, Error, GetDeallocateUpnlSigData, GetDeallocateUpnlSigQueryKey>
>;

/** TanStack Query options returned by {@link getDeallocateUpnlSigQueryOptions}. */
export type GetDeallocateUpnlSigQueryOptions = SymmioQueryOptions<
  GetDeallocateUpnlSigData,
  Error,
  GetDeallocateUpnlSigData,
  GetDeallocateUpnlSigQueryKey
>;

/**
 * Build TanStack Query options for {@link getDeallocateUpnlSig}.
 *
 * @remarks
 * The attestation is short-lived. For an actual `removeMargin` submit, prefer
 * fetching a fresh signature on demand (the `@symm-frontier/react`
 * `useRemoveMargin` hook does this) rather than serving a cached one. If you do
 * cache it — e.g. to display the attested uPnL — set a low `staleTime` and
 * refetch before submitting.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getDeallocateUpnlSigQueryOptions(config, { virtualAccount: "0xva…" }));
 * ```
 */
export function getDeallocateUpnlSigQueryOptions(
  config: Config,
  options: GetDeallocateUpnlSigOptions,
): GetDeallocateUpnlSigQueryOptions {
  return {
    ...options.query,
    queryKey: getDeallocateUpnlSigQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getDeallocateUpnlSig(config, { chainId: options.chainId, virtualAccount: options.virtualAccount }),
  };
}
