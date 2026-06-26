"use client";

import {
  getPendingWithdrawRequestsQueryOptions,
  type ConfigParameter,
  type GetPendingWithdrawRequestsOptions,
  type GetPendingWithdrawRequestsReturnType,
} from "@theoldvarorg/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link usePendingWithdrawRequests}: the core query options (user,
 * pagination, chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UsePendingWithdrawRequestsParameters = GetPendingWithdrawRequestsOptions & ConfigParameter;

/** Return type of {@link usePendingWithdrawRequests}. */
export type UsePendingWithdrawRequestsReturnType = UseQueryResult<
  GetPendingWithdrawRequestsReturnType,
  SymmioRequestError
>;

/**
 * List a subaccount's active (non-terminal) withdraw requests. The query is
 * disabled until `user` is set. `chainId` defaults to the connected chain.
 *
 * @example
 * ```tsx
 * const { data: pending } = usePendingWithdrawRequests({ user: subAccount });
 * ```
 */
export function usePendingWithdrawRequests(
  parameters: UsePendingWithdrawRequestsParameters = {},
): UsePendingWithdrawRequestsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getPendingWithdrawRequestsQueryOptions(config, {
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
  }) as UsePendingWithdrawRequestsReturnType;
}
