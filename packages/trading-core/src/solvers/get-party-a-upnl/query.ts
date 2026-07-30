import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getPartyAUpnl, type GetPartyAUpnlParameters, type GetPartyAUpnlReturnType } from "./get-party-a-upnl";

/** Data resolved by the {@link getPartyAUpnlQueryOptions} query. */
export type GetPartyAUpnlData = GetPartyAUpnlReturnType;

/**
 * Build the TanStack Query key for {@link getPartyAUpnlQueryOptions}.
 *
 * @param options - Query parameters (address, chain id, scope).
 * @returns A stable, hashable query key.
 */
export function getPartyAUpnlQueryKey(options: Compute<GetPartyAUpnlParameters & ConfigKeyParameter>) {
  return ["getPartyAUpnl", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getPartyAUpnlQueryKey}. */
export type GetPartyAUpnlQueryKey = ReturnType<typeof getPartyAUpnlQueryKey>;

/** Options accepted by {@link getPartyAUpnlQueryOptions}. */
export type GetPartyAUpnlOptions = Compute<
  GetPartyAUpnlParameters & QueryParameter<GetPartyAUpnlData, Error, GetPartyAUpnlData, GetPartyAUpnlQueryKey>
>;

/** TanStack Query options returned by {@link getPartyAUpnlQueryOptions}. */
export type GetPartyAUpnlQueryOptions = SymmioQueryOptions<
  GetPartyAUpnlData,
  Error,
  GetPartyAUpnlData,
  GetPartyAUpnlQueryKey
>;

/**
 * Build TanStack Query options for {@link getPartyAUpnl}. A non-rasa solver
 * surfaces `UNSUPPORTED_BY_SOLVER` from the query function.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 */
export function getPartyAUpnlQueryOptions(config: Config, options: GetPartyAUpnlOptions): GetPartyAUpnlQueryOptions {
  return {
    ...options.query,
    queryKey: getPartyAUpnlQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getPartyAUpnl(config, { address: options.address, chainId: options.chainId, solverId: options.solverId }),
  };
}
