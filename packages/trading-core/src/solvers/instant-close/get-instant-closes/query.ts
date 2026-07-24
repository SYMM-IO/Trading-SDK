import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getInstantCloses,
  type GetInstantClosesParameters,
  type GetInstantClosesReturnType,
} from "./get-instant-closes";

/** Data resolved by the {@link getInstantClosesQueryOptions} query. */
export type GetInstantClosesData = GetInstantClosesReturnType;

/**
 * Build the TanStack Query key for {@link getInstantClosesQueryOptions}.
 *
 * @param options - Query parameters (chain id, partyA, base url, config key).
 * @returns A stable, hashable query key.
 */
export function getInstantClosesQueryKey(
  options: Compute<ExactPartial<GetInstantClosesParameters> & ConfigKeyParameter> = {},
) {
  return ["getInstantCloses", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getInstantClosesQueryKey}. */
export type GetInstantClosesQueryKey = ReturnType<typeof getInstantClosesQueryKey>;

/**
 * Options accepted by {@link getInstantClosesQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetInstantClosesOptions = Compute<
  GetInstantClosesParameters &
    QueryParameter<GetInstantClosesData, Error, GetInstantClosesData, GetInstantClosesQueryKey>
>;

/** TanStack Query options returned by {@link getInstantClosesQueryOptions}. */
export type GetInstantClosesQueryOptions = SymmioQueryOptions<
  GetInstantClosesData,
  Error,
  GetInstantClosesData,
  GetInstantClosesQueryKey
>;

/**
 * Build TanStack Query options for {@link getInstantCloses}. Pass
 * `query.refetchInterval` to poll; disable from the consumer via `query.enabled`
 * (e.g. until a valid `partyA` is entered).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getInstantClosesQueryOptions(config, {
 *     partyA: "0xva…",
 *     query: { refetchInterval: 5_000 },
 *   }),
 * );
 * ```
 */
export function getInstantClosesQueryOptions(
  config: Config,
  options: GetInstantClosesOptions,
): GetInstantClosesQueryOptions {
  return {
    ...options.query,
    queryKey: getInstantClosesQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getInstantCloses(config, {
        chainId: options.chainId,
        solverId: options.solverId,
        partyA: options.partyA,
        baseUrl: options.baseUrl,
      }),
  };
}
