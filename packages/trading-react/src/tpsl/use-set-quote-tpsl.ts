"use client";

import {
  setQuoteTpSlMutationOptions,
  type ConfigParameter,
  type SetQuoteTpSlParameters,
  type SetQuoteTpSlReturnType,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { invalidateTpSlReads } from "./invalidate-tpsl";
import { useTpSlStore } from "./tpsl-store";

/** Parameters for {@link useSetQuoteTpSl}. */
export type UseSetQuoteTpSlParameters = ConfigParameter;

/** Return type of {@link useSetQuoteTpSl}. */
export type UseSetQuoteTpSlReturnType = UseMutationResult<
  SetQuoteTpSlReturnType,
  SymmioRequestError,
  SetQuoteTpSlParameters
>;

/**
 * Submit a TP/SL order for one quote. Signs an EIP-712 message with the
 * session-key wallet and POSTs to the handler.
 *
 * State machine (per side):
 * 1. `pending`    — POST in flight (`mutation.isPending`).
 * 2. `confirming` — POST returned 200; the store's `markConfirming` sets
 *    `tp/slState` to `"confirming"` and seeds the target trigger price so
 *    the UI can render it immediately.
 * 3. `new`        — Confirmed. The handler's live `report` (`applyNotification`)
 *    resolves the side first when the socket is connected; a refetch of the
 *    quote's TP/SL read on success is the authoritative backstop, so the box
 *    resolves out of `confirming` even when that frame is missed.
 */
export function useSetQuoteTpSl(parameters: UseSetQuoteTpSlParameters = {}): UseSetQuoteTpSlReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const base = setQuoteTpSlMutationOptions(config);
  const markConfirming = useTpSlStore((state) => state.markConfirming);

  return useMutation<SetQuoteTpSlReturnType, SymmioRequestError, SetQuoteTpSlParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        return await base.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: (result, variables) => {
      if (variables.tp) {
        markConfirming(variables.quoteId, "tp", {
          price: variables.tp.triggerPrice,
          pricePrecision: variables.pricePrecision,
          priceType: variables.tp.priceType,
          cohQuoteId: result.cohQuoteId,
        });
      }
      if (variables.sl) {
        markConfirming(variables.quoteId, "sl", {
          price: variables.sl.triggerPrice,
          pricePrecision: variables.pricePrecision,
          priceType: variables.sl.priceType,
          cohQuoteId: result.cohQuoteId,
        });
      }
      void invalidateTpSlReads(queryClient, [variables.quoteId]);
    },
  });
}
