"use client";

import {
  deallocateAndInitiateWithdrawMutationOptions,
  getAccountBalanceInfoQueryKey,
  getAccountBalanceOfQueryKey,
  getDeallocateUpnlSig,
  getPendingWithdrawRequestsQueryKey,
  getWithdrawableTimeQueryKey,
  type DeallocateAndInitiateWithdrawParameters,
  type SingleUpnlSig,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useDeallocateAndInitiateWithdraw}.
 */
export type UseDeallocateAndInitiateWithdrawParameters = WriteParameters;

/**
 * Variables for the {@link useDeallocateAndInitiateWithdraw} mutation: the core
 * action's inputs except `upnlSig` is **optional**. When omitted, the hook fetches
 * a fresh Muon uPnL signature itself (for the `deallocate` leg) before submitting;
 * pass one only to reuse a signature you already fetched.
 */
export type DeallocateAndInitiateWithdrawVariables = Omit<DeallocateAndInitiateWithdrawParameters, "upnlSig"> & {
  /** A pre-fetched Muon uPnL signature. Omit to let the hook fetch a fresh one. */
  upnlSig?: SingleUpnlSig;
};

/** Result returned by the {@link useDeallocateAndInitiateWithdraw} mutation. */
export type DeallocateAndInitiateWithdrawResult = WriteResult;

/** Return type of {@link useDeallocateAndInitiateWithdraw}. */
export type UseDeallocateAndInitiateWithdrawReturnType = UseMutationResult<
  DeallocateAndInitiateWithdrawResult,
  SymmioRequestError,
  DeallocateAndInitiateWithdrawVariables
>;

/**
 * Batch a subaccount's **deallocate** and **initiate-withdraw** into a single
 * atomic transaction — the cross-margin / Base withdraw path. The SDK routes both
 * core calls through one AccountLayer `_call`, so they succeed or revert together.
 *
 * The hook **fetches a fresh Muon uPnL signature** (the `deallocate` leg requires
 * it to prove the subaccount stays solvent) immediately before submitting, unless
 * you pass one as `upnlSig`. The connected wallet must own the subaccount. On
 * success, the subaccount's balance reads and its pending-requests /
 * withdrawable-time reads are invalidated.
 *
 * @remarks
 * The `deallocate` leg is subject to the on-chain deallocate debounce — submitting
 * too soon after a prior deallocate reverts the whole batch. That (and an
 * insolvent result, or a stale signature) is surfaced as a normalized
 * {@link SymmioRequestError}; enabling `simulateBeforeWrite` catches it as a
 * dry-run before anything is signed.
 *
 * @example
 * ```tsx
 * import { createClassicWithdrawPart } from "@symmio/trading-core";
 * const { mutate } = useDeallocateAndInitiateWithdraw();
 * mutate({
 *   account: "0xsub…",
 *   amount: 1_000000000000000000n,
 *   parts: [createClassicWithdrawPart({ id: 0n, amount, receiver, chainId: 999n })],
 * });
 * ```
 */
export function useDeallocateAndInitiateWithdraw(
  parameters: UseDeallocateAndInitiateWithdrawParameters = {},
): UseDeallocateAndInitiateWithdrawReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();

  const base = deallocateAndInitiateWithdrawMutationOptions(config);

  return useMutation<DeallocateAndInitiateWithdrawResult, SymmioRequestError, DeallocateAndInitiateWithdrawVariables>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const upnlSig =
          variables.upnlSig ??
          (await getDeallocateUpnlSig(config, {
            virtualAccount: variables.account,
            chainId: resolvedChainId,
          }));
        const hash = await base.mutationFn({
          account: variables.account,
          amount: variables.amount,
          parts: variables.parts,
          speedUp: variables.speedUp,
          providerData: variables.providerData,
          upnlSig,
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
      const balancePartial = { account: variables.account };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceInfoQueryKey, balancePartial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceOfQueryKey, balancePartial) });

      const withdrawPartial = { user: variables.account };
      void queryClient.invalidateQueries({
        predicate: predicateMatch(getPendingWithdrawRequestsQueryKey, withdrawPartial),
      });
      void queryClient.invalidateQueries({
        predicate: predicateMatch(getWithdrawableTimeQueryKey, withdrawPartial),
      });
    },
  });
}
