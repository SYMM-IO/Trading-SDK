"use client";

import {
  getMarginTransfersQueryOptions,
  type ConfigParameter,
  type GetMarginTransfersOptions,
  type GetMarginTransfersReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useMarginTransfers}: the core query options (filters, paging,
 * sort, chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseMarginTransfersParameters = GetMarginTransfersOptions & ConfigParameter;

/** Return type of {@link useMarginTransfers}: one page of rows plus `hasMore`. */
export type UseMarginTransfersReturnType = UseQueryResult<GetMarginTransfersReturnType, SymmioRequestError>;

/**
 * Read `MarginTransfer` entities — margin moved between a SubAccount and its
 * Virtual Accounts — from the analytics subgraph (`getMarginTransfers`). Every
 * filter is optional and applied only when passed; the query stays disabled
 * while a list filter is an empty array.
 *
 * `chainId` defaults to the connected chain. Errors normalized to
 * {@link SymmioRequestError}.
 *
 * @param parameters - Filters, paging, sort, optional chain id and config.
 * @returns The TanStack query result.
 *
 * @example
 * ```tsx
 * const { data } = useMarginTransfers({
 *   types: [MarginTransferType.Add],
 *   transactions: openTransactions,
 * });
 * ```
 */
export function useMarginTransfers(parameters: UseMarginTransfersParameters = {}): UseMarginTransfersReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getMarginTransfersQueryOptions(config, {
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
  }) as UseMarginTransfersReturnType;
}
