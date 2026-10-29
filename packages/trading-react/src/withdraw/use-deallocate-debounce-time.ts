"use client";

import {
  getDeallocateDebounceTimeQueryOptions,
  type ConfigParameter,
  type GetDeallocateDebounceTimeOptions,
  type GetDeallocateDebounceTimeReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useDeallocateDebounceTime}: the core query options
 * (optional chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseDeallocateDebounceTimeParameters = GetDeallocateDebounceTimeOptions & ConfigParameter;

/** Return type of {@link useDeallocateDebounceTime}. */
export type UseDeallocateDebounceTimeReturnType = UseQueryResult<
  GetDeallocateDebounceTimeReturnType,
  SymmioRequestError
>;

/**
 * Read the protocol's deallocate debounce, in seconds: the minimum gap the
 * SYMMIO core enforces between two deallocations of the same account. A
 * deallocation reverts until `withdrawCooldownOf(account) + debounce` has
 * passed (see {@link useWithdrawCooldownOf}); `0n` means no gap.
 *
 * It is a deployment-wide setting, the same for every account, so it rarely
 * changes. `chainId` defaults to the connected chain.
 *
 * @param parameters - Optional chain id, query overrides and config.
 * @returns The TanStack query result; `data` is the debounce in seconds.
 *
 * @example
 * ```tsx
 * const { data: debounceSeconds } = useDeallocateDebounceTime();
 * ```
 */
export function useDeallocateDebounceTime(
  parameters: UseDeallocateDebounceTimeParameters = {},
): UseDeallocateDebounceTimeReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getDeallocateDebounceTimeQueryOptions(config, {
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
  }) as UseDeallocateDebounceTimeReturnType;
}
