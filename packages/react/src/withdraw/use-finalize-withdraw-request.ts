"use client";

import {
  finalizeWithdrawRequestMutationOptions,
  getPendingWithdrawRequestsQueryKey,
  getWithdrawRequestsQueryKey,
  getWithdrawableTimeQueryKey,
  type FinalizeWithdrawRequestParameters,
} from "@symm-frontier/core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useFinalizeWithdrawRequest}.
 */
export type UseFinalizeWithdrawRequestParameters = WriteParameters;

/** Result returned by the {@link useFinalizeWithdrawRequest} mutation. */
export type FinalizeWithdrawRequestResult = WriteResult;

/** Return type of {@link useFinalizeWithdrawRequest}. */
export type UseFinalizeWithdrawRequestReturnType = UseMutationResult<
  FinalizeWithdrawRequestResult,
  SymmioRequestError,
  FinalizeWithdrawRequestParameters
>;

/**
 * Finalize a matured withdraw request, paying out collateral to its receivers.
 * The underlying core call is permissionless, so any connected wallet may submit
 * it. On success, the subaccount's pending-requests, single-request, and
 * withdrawable-time queries are invalidated.
 *
 * @example
 * ```tsx
 * const { mutate } = useFinalizeWithdrawRequest();
 * mutate({ user: "0xsub…", requestId: 1n });
 * ```
 */
export function useFinalizeWithdrawRequest(
  parameters: UseFinalizeWithdrawRequestParameters = {},
): UseFinalizeWithdrawRequestReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();

  const base = finalizeWithdrawRequestMutationOptions(config);

  return useMutation<FinalizeWithdrawRequestResult, SymmioRequestError, FinalizeWithdrawRequestParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const hash = await base.mutationFn({
          user: variables.user,
          requestId: variables.requestId,
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
      const partial = { user: variables.user };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getPendingWithdrawRequestsQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getWithdrawRequestsQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getWithdrawableTimeQueryKey, partial) });
    },
  });
}
