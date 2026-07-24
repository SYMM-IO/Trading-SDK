import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import { getInstantOpens, type GetInstantOpensParameters, type GetInstantOpensReturnType } from "./get-instant-opens";

/** Data resolved by the {@link getInstantOpensQueryOptions} query. */
export type GetInstantOpensData = GetInstantOpensReturnType;

/**
 * Build the TanStack Query key for {@link getInstantOpensQueryOptions}.
 *
 * @param options - Query parameters (chain id, partyA, base url, config key).
 * @returns A stable, hashable query key.
 */
export function getInstantOpensQueryKey(
  options: Compute<ExactPartial<GetInstantOpensParameters> & ConfigKeyParameter> = {},
) {
  return ["getInstantOpens", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getInstantOpensQueryKey}. */
export type GetInstantOpensQueryKey = ReturnType<typeof getInstantOpensQueryKey>;

/**
 * Options accepted by {@link getInstantOpensQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetInstantOpensOptions = Compute<
  GetInstantOpensParameters & QueryParameter<GetInstantOpensData, Error, GetInstantOpensData, GetInstantOpensQueryKey>
>;

/** TanStack Query options returned by {@link getInstantOpensQueryOptions}. */
export type GetInstantOpensQueryOptions = SymmioQueryOptions<
  GetInstantOpensData,
  Error,
  GetInstantOpensData,
  GetInstantOpensQueryKey
>;

/**
 * Build TanStack Query options for {@link getInstantOpens}. Pass
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
 *   getInstantOpensQueryOptions(config, {
 *     partyA: "0xva…",
 *     query: { refetchInterval: 5_000 },
 *   }),
 * );
 * ```
 */
export function getInstantOpensQueryOptions(
  config: Config,
  options: GetInstantOpensOptions,
): GetInstantOpensQueryOptions {
  return {
    ...options.query,
    queryKey: getInstantOpensQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getInstantOpens(config, {
        chainId: options.chainId,
        solverId: options.solverId,
        partyA: options.partyA,
        baseUrl: options.baseUrl,
      }),
  };
}
