import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import { getQuoteTpSl, type GetQuoteTpSlParameters, type GetQuoteTpSlReturnType } from "./get-quote-tpsl";

export type GetQuoteTpSlData = GetQuoteTpSlReturnType;

export function getQuoteTpSlQueryKey(options: Compute<GetQuoteTpSlParameters & ConfigKeyParameter>) {
  return ["getQuoteTpSl", { ...filterQueryOptions(options), quoteId: options.quoteId.toString() }] as const;
}

export type GetQuoteTpSlQueryKey = ReturnType<typeof getQuoteTpSlQueryKey>;

export type GetQuoteTpSlOptions = Compute<
  GetQuoteTpSlParameters & QueryParameter<GetQuoteTpSlData, Error, GetQuoteTpSlData, GetQuoteTpSlQueryKey>
>;

export type GetQuoteTpSlQueryOptions = SymmioQueryOptions<
  GetQuoteTpSlData,
  Error,
  GetQuoteTpSlData,
  GetQuoteTpSlQueryKey
>;

/**
 * Build TanStack Query options for {@link getQuoteTpSl}. Disabled until
 * `quoteId` is a real id (present + non-zero). Accepts negative ids (hedger
 * `tempQuoteId`) so a pre-chain quote's TP/SL can be read the moment the
 * hedger accepts an instant open — no wait for on-chain reconciliation.
 */
export function getQuoteTpSlQueryOptions(config: Config, options: GetQuoteTpSlOptions): GetQuoteTpSlQueryOptions {
  return {
    ...options.query,
    queryKey: getQuoteTpSlQueryKey({ ...options, configKey: config.getChainConfigKey(options.chainId) }),
    enabled: (options.query?.enabled ?? true) && isValidQuoteId(options.quoteId),
    queryFn: () => getQuoteTpSl(config, { chainId: options.chainId, quoteId: options.quoteId }),
  };
}

/**
 * Guard for the runtime shape of `quoteId`: not null, not undefined, and not
 * the `0n` sentinel that callers pass with the `??` fallback. TypeScript types
 * `quoteId` as `bigint`, but the boundary (`quote.quoteId` on unified quotes,
 * user input, cache hydration) can still surface `null`/`undefined` at
 * runtime, so we belt-and-braces it here.
 */
function isValidQuoteId(quoteId: unknown): quoteId is bigint {
  return typeof quoteId === "bigint" && quoteId !== 0n;
}
