"use client";

import {
  getSubgraphQuotesQueryOptions,
  type ConfigParameter,
  type GetSubgraphQuotesOptions,
  type GetSubgraphQuotesReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSubgraphQuotes}: the core query options (filters, paging,
 * sort, chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseSubgraphQuotesParameters = GetSubgraphQuotesOptions & ConfigParameter;

/** Return type of {@link useSubgraphQuotes}: one page of rows plus `hasMore`. */
export type UseSubgraphQuotesReturnType = UseQueryResult<GetSubgraphQuotesReturnType, SymmioRequestError>;

/**
 * Read the analytics subgraph's `Quote` entities as indexed
 * (`getSubgraphQuotes`) — funding index, settled funding totals, lifecycle
 * timestamps. For the live on-chain struct use {@link useQuote}.
 *
 * `chainId` defaults to the connected chain. Errors normalized to
 * {@link SymmioRequestError}.
 *
 * @param parameters - Filters, paging, sort, optional chain id and config.
 * @returns The TanStack query result.
 *
 * @example
 * ```tsx
 * const { data } = useSubgraphQuotes({ quoteIds: [quote.quoteId], source: diamond });
 * ```
 */
export function useSubgraphQuotes(parameters: UseSubgraphQuotesParameters = {}): UseSubgraphQuotesReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getSubgraphQuotesQueryOptions(config, {
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
  }) as UseSubgraphQuotesReturnType;
}
