"use client";

import {
  deleteQuoteTpSlMutationOptions,
  type ConfigParameter,
  type DeleteQuoteTpSlParameters,
  type DeleteQuoteTpSlReturnType,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { invalidateTpSlReads } from "./invalidate-tpsl";
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
  const queryClient = useQueryClient();
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
      // `intent: "cancel"` — this side is waiting to disappear, so an empty
      // refetch confirms it instead of being held off as a pending write.
      if (variables.conditionalOrderType === "take_profit") {
        markConfirming(variables.quoteId, "tp", { intent: "cancel" });
      }
      if (variables.conditionalOrderType === "stop_loss") {
        markConfirming(variables.quoteId, "sl", { intent: "cancel" });
      }
      void invalidateTpSlReads(queryClient, [variables.quoteId]);
    },
  });
}
