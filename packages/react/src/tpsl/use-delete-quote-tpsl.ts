"use client";

import {
  deleteQuoteTpSlMutationOptions,
  getQuoteTpSlQueryKey,
  type ConfigParameter,
  type DeleteQuoteTpSlParameters,
  type DeleteQuoteTpSlReturnType,
} from "@symm-frontier/core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { getTpSlConfirmingQueryKey, markTpSlConfirming } from "./tpsl-confirming";

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
 * with the session-key wallet and calls `DELETE /api/v5/`.
 *
 * State machine (per side):
 * 1. `pending`    — DELETE in flight (`mutation.isPending`).
 * 2. `confirming` — DELETE returned 200; the shared confirming slot flags the
 *    target side so `useQuoteTpSl` overlays "Processing…".
 * 3. Row gone    — Handler broadcast a `cancel` / `canceled` report;
 *    `useQuoteTpSl`'s WS listener clears the confirming flag and invalidates
 *    the row query. Fresh rows omit the canceled row → folded snapshot shows
 *    the side as empty (no active order).
 */
export function useDeleteQuoteTpSl(parameters: UseDeleteQuoteTpSlParameters = {}): UseDeleteQuoteTpSlReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const base = deleteQuoteTpSlMutationOptions(config);

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
      const resolvedChainId = variables.chainId ?? chainId;
      const configKey = config.getChainConfigKey(resolvedChainId);
      const rowsKey = getQuoteTpSlQueryKey({ chainId: resolvedChainId, quoteId: variables.quoteId, configKey });
      const confirmingKey = getTpSlConfirmingQueryKey({
        chainId: resolvedChainId,
        quoteId: variables.quoteId,
        configKey,
      });
      const isTp = variables.conditionalOrderType === "take_profit";
      const isSl = variables.conditionalOrderType === "stop_loss";
      markTpSlConfirming(queryClient, confirmingKey, { tp: isTp || undefined, sl: isSl || undefined });
      void queryClient.invalidateQueries({ queryKey: rowsKey });
    },
  });
}
