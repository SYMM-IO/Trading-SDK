"use client";

import {
  getUserTransactionsQueryOptions,
  type ConfigParameter,
  type GetUserTransactionsOptions,
  type GetUserTransactionsReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useUserTransactions}: the core query options plus an optional `config`. */
export type UseUserTransactionsParameters = GetUserTransactionsOptions & ConfigParameter;

/** Return type of {@link useUserTransactions}: one page of the user's transactions. */
export type UseUserTransactionsReturnType = UseQueryResult<GetUserTransactionsReturnType, SymmioRequestError>;

/**
 * Read the signed-in user's transaction history — their pool deposits and
 * withdrawals across **every** pool, newest first.
 *
 * Authed and scoped to the caller: it only ever returns transactions the user
 * owns, so pass the Bearer `accessToken` from {@link useAuthenticateListing}.
 * Optionally narrow by `transactionType`, `transactionStatus`, or `tokenAddress`.
 * `count` is the total across all pages, so it is what a pager should divide —
 * not `items.length`. Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useUserTransactions({ accessToken, size: 25 });
 * ```
 */
export function useUserTransactions(parameters: UseUserTransactionsParameters): UseUserTransactionsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getUserTransactionsQueryOptions(config, {
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
  }) as UseUserTransactionsReturnType;
}
