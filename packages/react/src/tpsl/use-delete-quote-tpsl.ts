"use client";

import {
  deleteQuoteTpSlMutationOptions,
  type ConfigParameter,
  type DeleteQuoteTpSlParameters,
  type DeleteQuoteTpSlReturnType,
} from "@symm-frontier/core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { useTpSlStore } from "./tpsl-store";

/** Parameters for {@link useDeleteQuoteTpSl}. */
export type UseDeleteQuoteTpSlParameters = ConfigParameter;

/** Return type of {@link useDeleteQuoteTpSl}. */
export type UseDeleteQuoteTpSlReturnType = UseMutationResult<
  DeleteQuoteTpSlReturnType,
  SymmioRequestError,
  DeleteQuoteTpSlParameters
>;

/**
 * Cancel a live TP or SL by its `cohQuoteId`. Signs an EIP-712 delete message
 * with the session-key wallet and calls `DELETE /api/v5/`. On 200 the target
 * side is marked `"confirming"` in the shared TP/SL store; the WS `cancel`
 * report flips it to `"canceled"` via `applyNotification`.
 */
export function useDeleteQuoteTpSl(parameters: UseDeleteQuoteTpSlParameters = {}): UseDeleteQuoteTpSlReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const base = deleteQuoteTpSlMutationOptions(config);
  const markConfirming = useTpSlStore((state) => state.markConfirming);

  return useMutation<DeleteQuoteTpSlReturnType, SymmioRequestError, DeleteQuoteTpSlParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        return await base.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: (_result, variables) => {
      if (variables.conditionalOrderType === "take_profit") markConfirming(variables.quoteId, "tp");
      if (variables.conditionalOrderType === "stop_loss") markConfirming(variables.quoteId, "sl");
    },
  });
}
