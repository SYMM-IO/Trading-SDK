"use client";

import {
  getQuoteEventsByTypeQueryOptions,
  type ConfigParameter,
  type GetQuoteEventsByTypeOptions,
  type GetQuoteEventsByTypeReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useQuoteEventsByType}: the core query options (quote id,
 * types, paging, sort, chain id, TanStack `query` overrides) plus an optional
 * `config`.
 */
export type UseQuoteEventsByTypeParameters = GetQuoteEventsByTypeOptions & ConfigParameter;

/** Return type of {@link useQuoteEventsByType}. */
export type UseQuoteEventsByTypeReturnType = UseQueryResult<GetQuoteEventsByTypeReturnType, SymmioRequestError>;

/**
 * Read non-terminal `QuoteEvent`s for one quote from the analytics subgraph,
 * filtered to the requested event types. Pair with {@link PRICE_HISTORY_EVENT_TYPES}
 * (or call {@link useQuotePriceHistory} for that preset filter).
 *
 * `chainId` defaults to the connected chain. Errors normalized to
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useQuoteEventsByType({ quoteId: quote.quoteId, types: PRICE_HISTORY_EVENT_TYPES });
 * ```
 */
export function useQuoteEventsByType(parameters: UseQuoteEventsByTypeParameters): UseQuoteEventsByTypeReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getQuoteEventsByTypeQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseQuoteEventsByTypeReturnType;
}
