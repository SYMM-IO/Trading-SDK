"use client";

import {
  getLastWithdrawRequestIdQueryKey,
  getPendingWithdrawRequestsQueryKey,
  getWithdrawableTimeQueryKey,
  initiateWithdrawMutationOptions,
  type InitiateWithdrawParameters,
} from "@symm-frontier/core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useInitiateWithdraw}.
 */
export type UseInitiateWithdrawParameters = WriteParameters;

/** Result returned by the {@link useInitiateWithdraw} mutation. */
export type InitiateWithdrawResult = WriteResult;

/** Return type of {@link useInitiateWithdraw}. */
export type UseInitiateWithdrawReturnType = UseMutationResult<
  InitiateWithdrawResult,
  SymmioRequestError,
  InitiateWithdrawParameters
>;

/**
 * Open a withdraw request for a subaccount (the SDK routes it through the
 * AccountLayer `_call` proxy). The full input surface is exposed via the mutation
 * variables — `parts`, `speedUp`, `providerData`. On success, the subaccount's
 * pending-requests, last-request-id, and withdrawable-time queries are
 * invalidated.
 *
 * @example
 * ```tsx
 * import { createClassicWithdrawPart } from "@symm-frontier/core";
 * const { mutate } = useInitiateWithdraw();
 * mutate({ account: "0xsub…", parts: [createClassicWithdrawPart({ id: 0n, amount, receiver, chainId: 999n })] });
 * ```
 */
export function useInitiateWithdraw(parameters: UseInitiateWithdrawParameters = {}): UseInitiateWithdrawReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();

  const base = initiateWithdrawMutationOptions(config);

  return useMutation<InitiateWithdrawResult, SymmioRequestError, InitiateWithdrawParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const hash = await base.mutationFn({
          account: variables.account,
          parts: variables.parts,
          speedUp: variables.speedUp,
          providerData: variables.providerData,
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
      const partial = { user: variables.account };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getPendingWithdrawRequestsQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getLastWithdrawRequestIdQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getWithdrawableTimeQueryKey, partial) });
    },
  });
}
