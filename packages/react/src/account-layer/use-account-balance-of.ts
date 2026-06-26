"use client";

import {
  getAccountBalanceOfQueryOptions,
  type ConfigParameter,
  type GetAccountBalanceOfOptions,
  type GetAccountBalanceOfReturnType,
} from "@theoldvarorg/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useAccountBalanceOf}: the core query options
 * (account, chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseAccountBalanceOfParameters = GetAccountBalanceOfOptions & ConfigParameter;

/** Return type of {@link useAccountBalanceOf}. */
export type UseAccountBalanceOfReturnType = UseQueryResult<GetAccountBalanceOfReturnType, SymmioRequestError>;

/**
 * Read raw `balanceOf` for a SYMMIO account. The query is disabled until
 * `account` is set. Omitted `chainId` resolves through the SDK config. Errors are
 * normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useAccountBalanceOf({ account });
 * ```
 */
export function useAccountBalanceOf(parameters: UseAccountBalanceOfParameters = {}): UseAccountBalanceOfReturnType {
  const config = useSymmioConfig(parameters);
  const options = getAccountBalanceOfQueryOptions(config, parameters);

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseAccountBalanceOfReturnType;
}
