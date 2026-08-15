import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getSendQuoteUpnlSig,
  type GetSendQuoteUpnlSigParameters,
  type GetSendQuoteUpnlSigReturnType,
} from "./get-send-quote-upnl-sig";

/** Data resolved by the {@link getSendQuoteUpnlSigQueryOptions} query. */
export type GetSendQuoteUpnlSigData = GetSendQuoteUpnlSigReturnType;

/**
 * Build the TanStack Query key for {@link getSendQuoteUpnlSigQueryOptions}.
 *
 * @param options - Query parameters (chain id, partyA, symbol id).
 * @returns A stable, hashable query key.
 */
export function getSendQuoteUpnlSigQueryKey(options: Compute<GetSendQuoteUpnlSigParameters & ConfigKeyParameter>) {
  return ["getSendQuoteUpnlSig", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getSendQuoteUpnlSigQueryKey}. */
export type GetSendQuoteUpnlSigQueryKey = ReturnType<typeof getSendQuoteUpnlSigQueryKey>;

/**
 * Options accepted by {@link getSendQuoteUpnlSigQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetSendQuoteUpnlSigOptions = Compute<
  GetSendQuoteUpnlSigParameters &
    QueryParameter<GetSendQuoteUpnlSigData, Error, GetSendQuoteUpnlSigData, GetSendQuoteUpnlSigQueryKey>
>;

/** TanStack Query options returned by {@link getSendQuoteUpnlSigQueryOptions}. */
export type GetSendQuoteUpnlSigQueryOptions = SymmioQueryOptions<
  GetSendQuoteUpnlSigData,
  Error,
  GetSendQuoteUpnlSigData,
  GetSendQuoteUpnlSigQueryKey
>;

/**
 * Build TanStack Query options for {@link getSendQuoteUpnlSig}.
 *
 * @remarks
 * The attestation is short-lived **and is signed inside the quote calldata**, so
 * a cached one is almost never what you want for an actual submit — fetch it on
 * demand instead (the instant-open Rasa path does this internally). Caching is
 * only appropriate for display.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getSendQuoteUpnlSigQueryOptions(config, { partyA: "0x…", symbolId: 1n }));
 * ```
 */
export function getSendQuoteUpnlSigQueryOptions(
  config: Config,
  options: GetSendQuoteUpnlSigOptions,
): GetSendQuoteUpnlSigQueryOptions {
  return {
    ...options.query,
    queryKey: getSendQuoteUpnlSigQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getSendQuoteUpnlSig(config, {
        chainId: options.chainId,
        partyA: options.partyA,
        symbolId: options.symbolId,
      }),
  };
}
