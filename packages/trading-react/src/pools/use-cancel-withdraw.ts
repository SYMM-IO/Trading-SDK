"use client";

import {
  cancelWithdrawMutationOptions,
  type CancelWithdrawParameters,
  type CancelWithdrawReturnType,
  type ConfigParameter,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useCancelWithdraw}: just an optional `config`. */
export type UseCancelWithdrawParameters = ConfigParameter;

/**
 * Variables for the {@link useCancelWithdraw} mutation — the same shape as core's
 * {@link CancelWithdrawParameters}.
 *
 * `accessToken` and `withdrawId` are required; `chainId` defaults to the
 * connected chain when omitted.
 */
export type CancelWithdrawVariables = CancelWithdrawParameters;

/**
 * Return type of {@link useCancelWithdraw}: resolves to a
 * `PoolCancelWithdrawResult` receipt on success, or a normalized error.
 */
export type UseCancelWithdrawReturnType = UseMutationResult<
  CancelWithdrawReturnType,
  SymmioRequestError,
  CancelWithdrawVariables
>;

/**
 * Cancel a queued LP withdrawal — remove a pending withdrawal from a pool's
 * withdrawal queue before it settles.
 *
 * The mutation `DELETE`s the withdrawal by its `withdrawId` — the `transactionId`
 * of a still-`PENDING` `withdraw` row from {@link usePoolTransactions} — authed
 * with the caller's Bearer `accessToken` (mint it with
 * {@link useAuthenticateListing}).
 *
 * On success the hook **invalidates every `getPoolTransactions` query**, so any
 * mounted transaction list refetches and drops the canceled withdrawal — the
 * caller does not need to refetch it by hand. The shares also return to the
 * user's available balance, so separately refetch {@link useUserProfit} to see
 * `availableLpAmount` rise and `pendingWithdrawLpAmount` fall.
 *
 * Pools is **chain-level** — `mutate` / `mutateAsync` reject with a normalized
 * {@link SymmioRequestError} (`LISTING_NOT_CONFIGURED`) on a chain with no listing
 * backend, and a bad or expired token comes back as a `CANCEL_WITHDRAW_FAILED`
 * `401`. A withdrawal that has already settled is rejected by the service.
 * Failures are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const cancel = useCancelWithdraw();
 * cancel.mutate({ accessToken, withdrawId: pending.transactionId });
 * ```
 */
export function useCancelWithdraw(parameters: UseCancelWithdrawParameters = {}): UseCancelWithdrawReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const options = cancelWithdrawMutationOptions(config);

  return useMutation({
    ...options,
    mutationFn: async (variables: CancelWithdrawVariables): Promise<CancelWithdrawReturnType> => {
      try {
        return await options.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: () => {
      // The canceled row leaves the pool's transaction lists. `cancelWithdraw`'s
      // variables carry no market/wallet to scope by, so invalidate every mounted
      // `getPoolTransactions` query by its key tag; each refetches and drops it.
      void queryClient.invalidateQueries({ queryKey: ["getPoolTransactions"] });
    },
  }) as UseCancelWithdrawReturnType;
}
