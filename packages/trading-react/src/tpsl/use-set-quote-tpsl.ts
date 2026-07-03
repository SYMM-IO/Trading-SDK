"use client";

import {
  getQuoteTpSlQueryKey,
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
import { getTpSlConfirmingQueryKey, markTpSlConfirming } from "./tpsl-confirming";

/** Parameters for {@link useSetQuoteTpSl}. */
export type UseSetQuoteTpSlParameters = ConfigParameter;

/** Return type of {@link useSetQuoteTpSl}. */
export type UseSetQuoteTpSlReturnType = UseMutationResult<
  SetQuoteTpSlReturnType,
  SymmioRequestError,
  SetQuoteTpSlParameters
>;

/**
 * Submit a TP/SL order for one on-chain quote. Signs an EIP-712 message with
 * the session-key wallet and posts to the handler.
 *
 * State machine (per side):
 * 1. `pending`   — POST in flight (`mutation.isPending`).
 * 2. `confirming` — POST returned 200; we've written the flag into the shared
 *    confirming cache slot ({@link getTpSlConfirmingQueryKey}). `useQuoteTpSl`
 *    overlays this as `tpState` / `slState = "confirming"`.
 * 3. `new`       — Handler broadcast a `report` with `successful: true`;
 *    `useQuoteTpSl`'s WS listener clears the confirming flag and invalidates
 *    the row query, so the fresh snapshot flips the side to active.
 */
export function useSetQuoteTpSl(parameters: UseSetQuoteTpSlParameters = {}): UseSetQuoteTpSlReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const base = setQuoteTpSlMutationOptions(config);

  return useMutation<SetQuoteTpSlReturnType, SymmioRequestError, SetQuoteTpSlParameters>({
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
      markTpSlConfirming(queryClient, confirmingKey, {
        tp: Boolean(variables.tp),
        sl: Boolean(variables.sl),
      });
      void queryClient.invalidateQueries({ queryKey: rowsKey });
    },
  });
}
