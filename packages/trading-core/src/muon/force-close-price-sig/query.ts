import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getForceClosePriceSig,
  type GetForceClosePriceSigParameters,
  type GetForceClosePriceSigReturnType,
} from "./get-force-close-price-sig";

/** Data resolved by the {@link getForceClosePriceSigQueryOptions} query. */
export type GetForceClosePriceSigData = GetForceClosePriceSigReturnType;

/**
 * Build the TanStack Query key for {@link getForceClosePriceSigQueryOptions}.
 *
 * @param options - Query parameters (chain id, window bounds, parties, symbol id).
 * @returns A stable, hashable query key.
 */
export function getForceClosePriceSigQueryKey(options: Compute<GetForceClosePriceSigParameters & ConfigKeyParameter>) {
  return ["getForceClosePriceSig", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getForceClosePriceSigQueryKey}. */
export type GetForceClosePriceSigQueryKey = ReturnType<typeof getForceClosePriceSigQueryKey>;

/**
 * Options accepted by {@link getForceClosePriceSigQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetForceClosePriceSigOptions = Compute<
  GetForceClosePriceSigParameters &
    QueryParameter<GetForceClosePriceSigData, Error, GetForceClosePriceSigData, GetForceClosePriceSigQueryKey>
>;

/** TanStack Query options returned by {@link getForceClosePriceSigQueryOptions}. */
export type GetForceClosePriceSigQueryOptions = SymmioQueryOptions<
  GetForceClosePriceSigData,
  Error,
  GetForceClosePriceSigData,
  GetForceClosePriceSigQueryKey
>;

/**
 * Build TanStack Query options for {@link getForceClosePriceSig}.
 *
 * @remarks
 * The attestation is short-lived. For an actual force-close submit, fetch a
 * fresh signature on demand rather than serving a cached one; if you do cache it
 * — e.g. to display the attested range — set a low `staleTime` and refetch
 * before submitting.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getForceClosePriceSigQueryOptions(config, {
 *     partyA: "0x…",
 *     partyB: solverAddress,
 *     symbolId: 1n,
 *     t0: 1735689600n,
 *     t1: 1735693200n,
 *   }),
 * );
 * ```
 */
export function getForceClosePriceSigQueryOptions(
  config: Config,
  options: GetForceClosePriceSigOptions,
): GetForceClosePriceSigQueryOptions {
  return {
    ...options.query,
    queryKey: getForceClosePriceSigQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getForceClosePriceSig(config, {
        chainId: options.chainId,
        t0: options.t0,
        t1: options.t1,
        partyA: options.partyA,
        partyB: options.partyB,
        symbolId: options.symbolId,
      }),
  };
}
