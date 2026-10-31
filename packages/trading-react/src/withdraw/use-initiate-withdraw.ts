"use client";

import {
  getLastWithdrawRequestIdQueryKey,
  getPendingWithdrawRequestsBatchQueryKey,
  getPendingWithdrawRequestsQueryKey,
  getWithdrawableTimeQueryKey,
  initiateWithdrawMutationOptions,
  type InitiateWithdrawParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useAutomaticTimelock } from "../account-layer/use-automatic-timelock";
import { normalizeProtectedWriteError } from "../errors/normalize-protected-write-error";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type AutomaticTimelockWriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useInitiateWithdraw}.
 */
export type UseInitiateWithdrawParameters = AutomaticTimelockWriteParameters;

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
 * import { createClassicWithdrawPart } from "@symmio/trading-core";
 * const { mutate } = useInitiateWithdraw();
 * mutate({ account: "0xsub…", parts: [createClassicWithdrawPart({ id: 0n, amount, receiver, chainId: 42161n })] });
 * ```
 */
export function useInitiateWithdraw(parameters: UseInitiateWithdrawParameters = {}): UseInitiateWithdrawReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const automaticTimelock = useAutomaticTimelock(config, parameters.automaticTimelock);

  const base = initiateWithdrawMutationOptions(config);

  return useMutation<InitiateWithdrawResult, SymmioRequestError, InitiateWithdrawParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      let authorization = variables.timelock;
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        authorization = await automaticTimelock(variables, {
          account: variables.account,
          chainId: resolvedChainId,
          functionName: "initiateWithdraw",
          explicit: authorization,
        });
        const hash = await base.mutationFn({
          ...variables,
          chainId: resolvedChainId,
          ...(authorization ? { timelock: authorization } : {}),
        });
        const result = resolveWriteResult(config, hash, {
          chainId: resolvedChainId,
          waitForReceipt: parameters.waitForReceipt,
          confirmations: parameters.confirmations,
        });
        const settled = await result;
        automaticTimelock.finish(variables, settled);
        return settled;
      } catch (err) {
        automaticTimelock.fail(variables, err);
        throw authorization ? normalizeProtectedWriteError(err, authorization) : normalizeSymmError(err);
      }
    },
    onSuccess: (result, variables) => {
      /** Broadcast-only callers own confirmation and the later batch refresh. */
      if (result.receipt) {
        void queryClient.invalidateQueries({
          predicate: predicateMatch(getPendingWithdrawRequestsBatchQueryKey, {
            configKey: config.getChainConfigKey(variables.chainId ?? chainId),
          }),
        });
      }
      const partial = { user: variables.account };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getPendingWithdrawRequestsQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getLastWithdrawRequestIdQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getWithdrawableTimeQueryKey, partial) });
    },
  });
}
