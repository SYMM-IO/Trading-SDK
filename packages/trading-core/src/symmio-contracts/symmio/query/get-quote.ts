import type { Config } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../../shared/types/query";
import { filterQueryOptions } from "../../../shared/utils/query";
import { getQuote, type GetQuoteParameters, type GetQuoteReturnType } from "../actions/get-quote";

/** Data resolved by the {@link getQuoteQueryOptions} query. */
export type GetQuoteData = GetQuoteReturnType;

/**
 * Build the TanStack Query key for {@link getQuoteQueryOptions}.
 *
 * @param options - Partial query parameters (chain id, quote id).
 * @returns A stable, hashable query key.
 */
export function getQuoteQueryKey(options: Compute<ExactPartial<GetQuoteParameters> & ConfigKeyParameter> = {}) {
  return ["getQuote", filterQueryOptions(options)] as const;
}

/** Query-key type produced by {@link getQuoteQueryKey}. */
export type GetQuoteQueryKey = ReturnType<typeof getQuoteQueryKey>;

/**
 * Options accepted by {@link getQuoteQueryOptions}: the action's parameters (all
 * optional), an optional cache scope, and TanStack overrides.
 */
export type GetQuoteOptions = Compute<
  ExactPartial<GetQuoteParameters> & QueryParameter<GetQuoteData, Error, GetQuoteData, GetQuoteQueryKey>
>;

/** TanStack Query options returned by {@link getQuoteQueryOptions}. */
export type GetQuoteQueryOptions = SymmioQueryOptions<GetQuoteData, Error, GetQuoteData, GetQuoteQueryKey>;

/**
 * Build TanStack Query options for {@link getQuote}. The query is disabled until
 * `quoteId` is set. An unsupported chain surfaces a {@link SymmError} from the
 * query function (it is not silently disabled).
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getQuoteQueryOptions(config, { quoteId, chainId }));
 * ```
 */
export function getQuoteQueryOptions(config: Config, options: GetQuoteOptions = {}): GetQuoteQueryOptions {
  return {
    ...options.query,
    queryKey: getQuoteQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: options.quoteId !== undefined && (options.query?.enabled ?? true),
    queryFn: () => {
      const { chainId, quoteId } = options;
      if (quoteId === undefined) {
        throw new SymmError("validation", "MISSING_QUOTE_ID", "getQuote: `quoteId` is required.");
      }
      return getQuote(config, { chainId, quoteId });
    },
  };
}
