import type { Config } from "../../core/config";
import type { Compute, ConfigKeyParameter, ExactPartial } from "../../shared/types/properties";
import type { QueryParameter, SymmioQueryOptions } from "../../shared/types/query";
import { filterQueryOptions } from "../../shared/utils/query";
import {
  getGaslessFeeQuote,
  type GetGaslessFeeQuoteParameters,
  type GetGaslessFeeQuoteReturnType,
} from "./get-gasless-fee-quote";

/** Data resolved by the {@link getGaslessFeeQuoteQueryOptions} query. */
export type GetGaslessFeeQuoteData = GetGaslessFeeQuoteReturnType;

/**
 * Build the TanStack Query key for {@link getGaslessFeeQuoteQueryOptions}.
 *
 * An omitted `walletId` keys as `0n`, so `{ operation }` and
 * `{ operation, walletId: 0n }` share one cache entry — they quote the same call.
 *
 * @param options - Partial query parameters.
 * @returns A stable, hashable query key.
 */
export function getGaslessFeeQuoteQueryKey(
  options: Compute<ExactPartial<GetGaslessFeeQuoteParameters> & ConfigKeyParameter> = {},
) {
  const operations = options.operations?.map((entry) => ({ ...entry, walletId: entry.walletId ?? 0n }));
  return ["getGaslessFeeQuote", filterQueryOptions({ ...options, operations })] as const;
}

/** Query-key type produced by {@link getGaslessFeeQuoteQueryKey}. */
export type GetGaslessFeeQuoteQueryKey = ReturnType<typeof getGaslessFeeQuoteQueryKey>;

/**
 * Options accepted by {@link getGaslessFeeQuoteQueryOptions}.
 */
export type GetGaslessFeeQuoteOptions = Compute<
  GetGaslessFeeQuoteParameters &
    QueryParameter<GetGaslessFeeQuoteData, Error, GetGaslessFeeQuoteData, GetGaslessFeeQuoteQueryKey>
>;

/** TanStack Query options returned by {@link getGaslessFeeQuoteQueryOptions}. */
export type GetGaslessFeeQuoteQueryOptions = SymmioQueryOptions<
  GetGaslessFeeQuoteData,
  Error,
  GetGaslessFeeQuoteData,
  GetGaslessFeeQuoteQueryKey
>;

/**
 * Build TanStack Query options for {@link getGaslessFeeQuote}.
 *
 * The key covers every operation field and wallet id, so a changed nonce,
 * calldata or wallet re-quotes instead of reusing a stale quote.
 *
 * @param config - The SDK config.
 * @param options - Query parameters and TanStack overrides.
 * @returns Options to pass to `useQuery` / `queryClient.fetchQuery`.
 *
 * @example
 * ```ts
 * useQuery(getGaslessFeeQuoteQueryOptions(config, { operations: [{ operation }] }));
 * ```
 */
export function getGaslessFeeQuoteQueryOptions(
  config: Config,
  options: GetGaslessFeeQuoteOptions,
): GetGaslessFeeQuoteQueryOptions {
  return {
    ...options.query,
    queryKey: getGaslessFeeQuoteQueryKey({
      ...options,
      configKey: config.getChainConfigKey(options.chainId),
    }),
    enabled: options.query?.enabled ?? true,
    queryFn: () => getGaslessFeeQuote(config, { chainId: options.chainId, operations: options.operations }),
  };
}
