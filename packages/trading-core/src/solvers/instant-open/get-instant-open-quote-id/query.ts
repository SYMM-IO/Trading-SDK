import type { Config } from "../../../core/config";
import type { Compute, ConfigKeyParameter } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import {
  getInstantOpenQuoteId,
  type GetInstantOpenQuoteIdParameters,
  type GetInstantOpenQuoteIdReturnType,
} from "./get-instant-open-quote-id";

/** Data resolved by the {@link getInstantOpenQuoteIdQueryOptions} query. */
export type GetInstantOpenQuoteIdData = GetInstantOpenQuoteIdReturnType;

/**
 * Build the TanStack Query key for {@link getInstantOpenQuoteIdQueryOptions}.
 *
 * @param options - Query parameters (chain id, temp quote id, base url, config key).
 * @returns A stable, hashable query key.
 */
export function getInstantOpenQuoteIdQueryKey(options: Compute<GetInstantOpenQuoteIdParameters & ConfigKeyParameter>) {
  return ["getInstantOpenQuoteId", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getInstantOpenQuoteIdQueryKey}. */
export type GetInstantOpenQuoteIdQueryKey = ReturnType<typeof getInstantOpenQuoteIdQueryKey>;

/**
 * Options accepted by {@link getInstantOpenQuoteIdQueryOptions}: the action's
 * parameters, an optional cache scope, and TanStack overrides.
 */
export type GetInstantOpenQuoteIdOptions = Compute<
  GetInstantOpenQuoteIdParameters &
    QueryParameter<GetInstantOpenQuoteIdData, Error, GetInstantOpenQuoteIdData, GetInstantOpenQuoteIdQueryKey>
>;

/** TanStack Query options returned by {@link getInstantOpenQuoteIdQueryOptions}. */
export type GetInstantOpenQuoteIdQueryOptions = SymmioQueryOptions<
  GetInstantOpenQuoteIdData,
  Error,
  GetInstantOpenQuoteIdData,
  GetInstantOpenQuoteIdQueryKey
>;

/**
 * Build TanStack Query options for {@link getInstantOpenQuoteId}. Poll with
 * `query.refetchInterval` until the returned id is non-null, then disable.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getInstantOpenQuoteIdQueryOptions(config, {
 *     tempQuoteId: -1001,
 *     query: { refetchInterval: 2_000 },
 *   }),
 * );
 * ```
 */
export function getInstantOpenQuoteIdQueryOptions(
  config: Config,
  options: GetInstantOpenQuoteIdOptions,
): GetInstantOpenQuoteIdQueryOptions {
  return {
    ...options.query,
    queryKey: getInstantOpenQuoteIdQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () =>
      getInstantOpenQuoteId(config, {
        chainId: options.chainId,
        solverId: options.solverId,
        tempQuoteId: options.tempQuoteId,
        baseUrl: options.baseUrl,
      }),
  };
}
