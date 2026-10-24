"use client";

import {
  getQuoteFundingSettlementsQueryOptions,
  type ConfigParameter,
  type GetQuoteFundingSettlementsOptions,
  type GetQuoteFundingSettlementsReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useQuoteFundingSettlements}: the core query options (filters, paging,
 * sort, chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseQuoteFundingSettlementsParameters = GetQuoteFundingSettlementsOptions & ConfigParameter;

/** Return type of {@link useQuoteFundingSettlements}: one page of rows plus `hasMore`. */
export type UseQuoteFundingSettlementsReturnType = UseQueryResult<
  GetQuoteFundingSettlementsReturnType,
  SymmioRequestError
>;

/**
 * Read `QuoteFundingSettlement` entities — one per funding settlement on a
 * quote — from the analytics subgraph (`getQuoteFundingSettlements`). Every
 * filter is optional and applied only when passed.
 *
 * `chainId` defaults to the connected chain. Errors normalized to
 * {@link SymmioRequestError}.
 *
 * @param parameters - Filters, paging, sort, optional chain id and config.
 * @returns The TanStack query result.
 *
 * @example
 * ```tsx
 * const { data } = useQuoteFundingSettlements({ quoteIds: [quote.quoteId], orderBy: "id", orderDirection: "asc" });
 * ```
 */
export function useQuoteFundingSettlements(
  parameters: UseQuoteFundingSettlementsParameters = {},
): UseQuoteFundingSettlementsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getQuoteFundingSettlementsQueryOptions(config, {
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
  }) as UseQuoteFundingSettlementsReturnType;
}
