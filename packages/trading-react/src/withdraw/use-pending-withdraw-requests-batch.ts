"use client";
import {
  getPendingWithdrawRequestsBatchQueryOptions,
  type ConfigParameter,
  type GetPendingWithdrawRequestsBatchOptions,
  type GetPendingWithdrawRequestsBatchReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
/** Inputs for complete multi-subaccount pending-withdrawal reads. */
export type UsePendingWithdrawRequestsBatchParameters = GetPendingWithdrawRequestsBatchOptions & ConfigParameter;
/** Query state and complete per-user pending requests. */
export type UsePendingWithdrawRequestsBatchReturnType = UseQueryResult<
  GetPendingWithdrawRequestsBatchReturnType,
  SymmioRequestError
>;
/**
 * Read every pending-withdrawal page for each distinct user. Empty users disable
 * automatic reads; errors are normalized and never become partial empty balances.
 * @param parameters - Users, optional page size, chain/config and query overrides.
 * @returns The complete query result. Presentation and polling policy stay with the consumer.
 * @example
 * ```tsx
 * const pending = usePendingWithdrawRequestsBatch({ users: subAccounts, chainId });
 * ```
 */
export function usePendingWithdrawRequestsBatch(
  parameters: UsePendingWithdrawRequestsBatchParameters = {},
): UsePendingWithdrawRequestsBatchReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getPendingWithdrawRequestsBatchQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });
  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  }) as UsePendingWithdrawRequestsBatchReturnType;
}
