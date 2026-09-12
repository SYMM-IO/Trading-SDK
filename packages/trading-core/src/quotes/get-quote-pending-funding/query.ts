import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { toQuoteIdKeyPart } from "../quote-id-key-part";
import {
  getQuotePendingFunding,
  type GetQuotePendingFundingParameters,
  type GetQuotePendingFundingReturnType,
} from "./get-quote-pending-funding";

/** Data resolved by the {@link getQuotePendingFundingQueryOptions} query. */
export type GetQuotePendingFundingData = GetQuotePendingFundingReturnType;

/**
 * Build the TanStack Query key for {@link getQuotePendingFundingQueryOptions}.
 *
 * Accepts a partial scope so `predicateMatch(getQuotePendingFundingQueryKey, { configKey })`
 * can match every pending-funding read of one chain scope. When `quoteIds` is
 * present it is de-duplicated, sorted and stringified, so the same id set in any
 * order (or with repeats) shares one cache entry — safe because each row
 * carries its own `quoteId`.
 *
 * @param options - Partial query parameters (quote ids, chain id, batch size, config key).
 * @returns A stable, hashable query key.
 *
 * @example
 * ```ts
 * getQuotePendingFundingQueryKey({ quoteIds: [7335n, 7334n, 7334n] });
 * // → ["getQuotePendingFunding", { quoteIds: ["7334", "7335"] }]
 * getQuotePendingFundingQueryKey({ configKey });
 * // → ["getQuotePendingFunding", { configKey }] — a scope, e.g. for `predicateMatch`
 * ```
 */
export function getQuotePendingFundingQueryKey(
  options: Compute<ExactPartial<GetQuotePendingFundingParameters> & ConfigKeyParameter> = {},
) {
  const filtered = filterQueryOptions(options);
  if (options.quoteIds !== undefined) filtered.quoteIds = toQuoteIdKeyPart([...new Set(options.quoteIds)]);
  return ["getQuotePendingFunding", filtered] as const;
}

/** Query-key type produced by {@link getQuotePendingFundingQueryKey}. */
export type GetQuotePendingFundingQueryKey = ReturnType<typeof getQuotePendingFundingQueryKey>;

/**
 * Options accepted by {@link getQuotePendingFundingQueryOptions}: the action's
 * parameters (`quoteIds` required) plus TanStack overrides.
 */
export type GetQuotePendingFundingOptions = Compute<
  GetQuotePendingFundingParameters &
    QueryParameter<GetQuotePendingFundingData, Error, GetQuotePendingFundingData, GetQuotePendingFundingQueryKey>
>;

/** TanStack Query options returned by {@link getQuotePendingFundingQueryOptions}. */
export type GetQuotePendingFundingQueryOptions = SymmioQueryOptions<
  GetQuotePendingFundingData,
  Error,
  GetQuotePendingFundingData,
  GetQuotePendingFundingQueryKey
>;

/**
 * Build TanStack Query options for {@link getQuotePendingFunding}. The query is
 * disabled until at least one `quoteId` is supplied. No polling is set — pass
 * `query.refetchInterval` to keep the value fresh. An unsupported chain surfaces
 * a {@link SymmError} from the query function (it is not silently disabled).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(
 *   getQuotePendingFundingQueryOptions(config, {
 *     quoteIds: [7334n, 7335n],
 *     query: { refetchInterval: 60_000 },
 *   }),
 * );
 * ```
 */
export function getQuotePendingFundingQueryOptions(
  config: Config,
  options: GetQuotePendingFundingOptions,
): GetQuotePendingFundingQueryOptions {
  return {
    ...options.query,
    queryKey: getQuotePendingFundingQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: (options.query?.enabled ?? true) && options.quoteIds.length > 0,
    queryFn: () =>
      getQuotePendingFunding(config, {
        chainId: options.chainId,
        quoteIds: options.quoteIds,
        batchSize: options.batchSize,
      }),
  };
}
