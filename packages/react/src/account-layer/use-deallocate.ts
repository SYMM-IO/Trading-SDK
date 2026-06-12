"use client";

import {
  deallocateMutationOptions,
  getAccountBalanceInfoQueryKey,
  getAccountBalanceOfQueryKey,
  getDeallocateUpnlSig,
  type DeallocateParameters,
  type SingleUpnlSig,
} from "@symm-frontier/core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useDeallocate}.
 */
export type UseDeallocateParameters = WriteParameters;

/**
 * Variables for the {@link useDeallocate} mutation: the core action's inputs
 * except `upnlSig` is **optional**. When omitted, the hook fetches a fresh Muon
 * uPnL signature itself before submitting; pass one only to reuse a signature you
 * already fetched.
 */
export type DeallocateVariables = Omit<DeallocateParameters, "upnlSig"> & {
  /** A pre-fetched Muon uPnL signature. Omit to let the hook fetch a fresh one. */
  upnlSig?: SingleUpnlSig;
};

/** Result returned by the {@link useDeallocate} mutation. */
export type DeallocateResult = WriteResult;

/** Return type of {@link useDeallocate}. */
export type UseDeallocateReturnType = UseMutationResult<DeallocateResult, SymmioRequestError, DeallocateVariables>;

/**
 * Deallocate a subaccount's allocated (tradeable) balance back into its available
 * balance (routed through the AccountLayer `_call` proxy). The hook **fetches a
 * fresh Muon uPnL signature** (the contract requires it to prove the subaccount
 * stays solvent) immediately before submitting, unless you pass one as `upnlSig`.
 * The connected wallet must own the subaccount. On success, the subaccount's
 * balance reads are invalidated.
 *
 * @remarks
 * Subject to the on-chain deallocate debounce — submitting too soon after a prior
 * deallocate reverts. That (and an insolvent result, or a stale signature) is
 * surfaced as a normalized {@link SymmioRequestError}; enabling `simulateBeforeWrite`
 * catches it as a dry-run before anything is signed.
 *
 * @example
 * ```tsx
 * const { mutate } = useDeallocate();
 * mutate({ account: "0xsub…", amount: 1_000000000000000000n });
 * ```
 */
export function useDeallocate(parameters: UseDeallocateParameters = {}): UseDeallocateReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();

  const base = deallocateMutationOptions(config);

  return useMutation<DeallocateResult, SymmioRequestError, DeallocateVariables>({
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
      const partial = { account: variables.account };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceInfoQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAccountBalanceOfQueryKey, partial) });
    },
  });
}
