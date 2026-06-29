"use client";

import {
  getTransferHistoryQueryOptions,
  type ConfigParameter,
  type GetTransferHistoryOptions,
  type GetTransferHistoryReturnType,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useTransferHistory}: the core query options (accounts,
 * direction, paging, time range, chain id, TanStack `query` overrides) plus an
 * optional `config`.
 */
export type UseTransferHistoryParameters = GetTransferHistoryOptions & ConfigParameter;

/** Return type of {@link useTransferHistory}. */
export type UseTransferHistoryReturnType = UseQueryResult<GetTransferHistoryReturnType, SymmioRequestError>;

/**
 * Read internal transfers (margin moves between SYMMIO accounts) from the events
 * subgraph. Each row carries raw `from` / `to` endpoints, an 18-decimal `amount`,
 * and a `direction` relative to the queried accounts. The query is disabled until
 * at least one `account` is supplied; `chainId` defaults to the connected chain.
 * Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useTransferHistory({ accounts: [subAccount], direction: "outgoing" });
 * data?.rows.map((row) => `${row.from} → ${row.to}`);
 * ```
 */
export function useTransferHistory(parameters: UseTransferHistoryParameters): UseTransferHistoryReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getTransferHistoryQueryOptions(config, {
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
  }) as UseTransferHistoryReturnType;
}
