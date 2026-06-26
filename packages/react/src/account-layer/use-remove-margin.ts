"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import {
  getAccountBalanceInfoQueryKey,
  getAccountBalanceOfQueryKey,
  getDeallocateUpnlSig,
  removeMarginMutationOptions,
  type RemoveMarginParameters,
  type SingleUpnlSig,
} from "@theoldvarorg/core";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useRemoveMargin}.
 */
export type UseRemoveMarginParameters = WriteParameters;

/**
 * Variables for the {@link useRemoveMargin} mutation: the core action's inputs
 * except `upnlSig` is **optional**. When omitted, the hook fetches a fresh Muon
 * uPnL signature itself before submitting; pass one only to reuse a signature you
 * already fetched.
 */
export type RemoveMarginVariables = Omit<RemoveMarginParameters, "upnlSig"> & {
  /** A pre-fetched Muon uPnL signature. Omit to let the hook fetch a fresh one. */
  upnlSig?: SingleUpnlSig;
};

/** Result returned by the {@link useRemoveMargin} mutation. */
export type RemoveMarginResult = WriteResult;

/** Return type of {@link useRemoveMargin}. */
export type UseRemoveMarginReturnType = UseMutationResult<
  RemoveMarginResult,
  SymmioRequestError,
  RemoveMarginVariables
>;

/**
 * Remove margin from a virtual account (VA) — a deallocate via
 * `AccountLayer.removeMargin`. The hook **fetches a fresh Muon uPnL signature**
 * (the contract requires it to prove the VA stays solvent) immediately before
 * submitting, unless you pass one as `upnlSig`. The connected wallet must own the
 * VA. On success, the VA's balance reads are invalidated.
 *
 * @remarks
 * Subject to the on-chain deallocate debounce — submitting too soon after a prior
 * deallocate reverts. That (and an insolvent result, or a stale signature) is
 * surfaced as a normalized {@link SymmioRequestError}; enabling `simulateBeforeWrite`
 * catches it as a dry-run before anything is signed.
 *
 * @example
 * ```tsx
 * const { mutate } = useRemoveMargin();
 * mutate({ virtualAccount: "0xva…", amount: 50_000000000000000000n });
 * ```
 */
export function useRemoveMargin(parameters: UseRemoveMarginParameters = {}): UseRemoveMarginReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();

  const base = removeMarginMutationOptions(config);

  return useMutation<RemoveMarginResult, SymmioRequestError, RemoveMarginVariables>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const upnlSig =
          variables.upnlSig ??
          (await getDeallocateUpnlSig(config, {
            virtualAccount: variables.virtualAccount,
            chainId: resolvedChainId,
          }));
        const hash = await base.mutationFn({
          virtualAccount: variables.virtualAccount,
          amount: variables.amount,
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
      const partial = { account: variables.virtualAccount };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceInfoQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceOfQueryKey, partial) });
    },
  });
}
