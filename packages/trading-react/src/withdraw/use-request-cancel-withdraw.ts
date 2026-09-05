"use client";

import {
  getAccountBalanceInfoQueryKey,
  getAccountBalanceOfQueryKey,
  getPendingWithdrawRequestsQueryKey,
  getWithdrawRequestsQueryKey,
  requestCancelWithdrawMutationOptions,
  type RequestCancelWithdrawParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useRequestCancelWithdraw}.
 */
export type UseRequestCancelWithdrawParameters = WriteParameters;

/** Result returned by the {@link useRequestCancelWithdraw} mutation. */
export type RequestCancelWithdrawResult = WriteResult;

/** Return type of {@link useRequestCancelWithdraw}. */
export type UseRequestCancelWithdrawReturnType = UseMutationResult<
  RequestCancelWithdrawResult,
  SymmioRequestError,
  RequestCancelWithdrawParameters
>;

/**
 * Request cancellation of a pending withdraw request (routed through the
 * AccountLayer `_call` proxy). On success (after the receipt), the subaccount's
 * balance reads (`balanceInfo`, `balanceOf`) and its pending-requests / requests
 * queries are invalidated — cancel returns the reserved funds to the available
 * balance.
 *
 * @example
 * ```tsx
 * const { mutate } = useRequestCancelWithdraw();
 * mutate({ account: "0xsub…", requestId: 1n });
 * ```
 */
export function useRequestCancelWithdraw(
  parameters: UseRequestCancelWithdrawParameters = {},
): UseRequestCancelWithdrawReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();

  const base = requestCancelWithdrawMutationOptions(config);

  return useMutation<RequestCancelWithdrawResult, SymmioRequestError, RequestCancelWithdrawParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const hash = await base.mutationFn({
          account: variables.account,
          requestId: variables.requestId,
          simulateBeforeWrite: variables.simulateBeforeWrite,
          chainId: resolvedChainId,
        });
        return resolveWriteResult(config, hash, {
          chainId: resolvedChainId,
          waitForReceipt: parameters.waitForReceipt,
          confirmations: parameters.confirmations,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: (_result, variables) => {
      // Cancel returns the reserved funds to the subaccount's available balance and
      // removes the request — refetch balances + the withdraw lists (after the receipt).
      const balancePartial = { account: variables.account };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceInfoQueryKey, balancePartial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceOfQueryKey, balancePartial) });

      const withdrawPartial = { user: variables.account };
      void queryClient.invalidateQueries({
        predicate: predicateMatch(getPendingWithdrawRequestsQueryKey, withdrawPartial),
      });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getWithdrawRequestsQueryKey, withdrawPartial) });
    },
  });
}
