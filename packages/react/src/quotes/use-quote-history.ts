"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  getQuoteHistoryQueryOptions,
  type ConfigParameter,
  type GetQuoteHistoryOptions,
  type GetQuoteHistoryReturnType,
} from "@theoldvarorg/core";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useQuoteHistory}: the core query options (subAccounts,
 * close type, paging, time range, chain id, TanStack `query` overrides) plus an
 * optional `config`.
 */
export type UseQuoteHistoryParameters = GetQuoteHistoryOptions & ConfigParameter;

/** Return type of {@link useQuoteHistory}. */
export type UseQuoteHistoryReturnType = UseQueryResult<GetQuoteHistoryReturnType, SymmioRequestError>;

/**
 * Read a subaccount's closed/liquidated quote history from the analytics
 * subgraph. Each row is one close/liquidation event with its immutable metadata
 * snapshot applied, so partial-close rows stay individually accurate. The query
 * is disabled until at least one `subAccount` is supplied; `chainId` defaults to
 * the connected chain. Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useQuoteHistory({ subAccounts: [active], closeType: QuoteCloseType.Liquidated });
 * data?.rows.map((row) => row.eventId);
 * ```
 */
export function useQuoteHistory(parameters: UseQuoteHistoryParameters): UseQuoteHistoryReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getQuoteHistoryQueryOptions(config, {
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
  }) as UseQuoteHistoryReturnType;
}
