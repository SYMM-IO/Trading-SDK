"use client";

import {
  getInstantOpensQueryKey,
  instantOpenAutoMutationOptions,
  setQuoteTpSlMutationOptions,
  type ConfigParameter,
  type InstantOpenReturnType,
  type PrepareInstantOpenParameters,
  type SetQuoteTpSlParameters,
  type SetQuoteTpSlReturnType,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useState } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { useTpSlStore } from "../tpsl/tpsl-store";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useInstantOpenWithTpSl}: the standard instant-open
 * inputs, plus an optional `tpsl` block that mirrors {@link SetQuoteTpSlParameters}
 * minus `quoteId` (derived from the hedger response) and `chainId` (defaulted).
 *
 * When `tpsl` is omitted (or both `tp` and `sl` are empty), the hook behaves
 * exactly like {@link useInstantOpenAuto}. When present, the SDK dispatches
 * `setQuoteTpSl` immediately after the hedger returns a `tempQuoteId` — the
 * message is signed against the (predicted) VA the caller supplies, so no
 * on-chain reconciliation wait is needed. Confirmation still comes through the
 * TP/SL WebSocket picked up by {@link useQuoteTpSl}.
 */
export interface UseInstantOpenWithTpSlVariables extends PrepareInstantOpenParameters {
  tpsl?: Omit<SetQuoteTpSlParameters, "quoteId" | "chainId">;
}

/** Aggregated success payload from {@link useInstantOpenWithTpSl}. */
export interface UseInstantOpenWithTpSlData {
  instantOpen: InstantOpenReturnType;
  /** Set when the TP/SL leg was attempted and succeeded. */
  tpsl?: SetQuoteTpSlReturnType;
  /** Set when the TP/SL leg was attempted and failed — instant open still landed. */
  tpslError?: SymmioRequestError;
}

/** Which leg the orchestrator is currently on. */
export type UseInstantOpenWithTpSlPhase = "idle" | "opening" | "attaching-tpsl" | "success" | "error";

/** Parameters for {@link useInstantOpenWithTpSl}. */
export type UseInstantOpenWithTpSlParameters = ConfigParameter;

/** Return type of {@link useInstantOpenWithTpSl}. */
export type UseInstantOpenWithTpSlReturnType = UseMutationResult<
  UseInstantOpenWithTpSlData,
  SymmioRequestError,
  UseInstantOpenWithTpSlVariables
> & {
  /** Current orchestration phase. Handy for phased status UI. */
  phase: UseInstantOpenWithTpSlPhase;
};

/**
 * One-shot orchestrator: post an instant open and — if the caller pre-filled
 * a TP/SL block — immediately submit `setQuoteTpSl` using the hedger's returned
 * `tempQuoteId`. Web layer just wires inputs; all mutation logic (both legs +
 * cache invalidation + confirming-slot write) lives in the SDK.
 *
 * @example
 * ```tsx
 * const open = useInstantOpenWithTpSl();
 * open.mutate({
 *   ...instantOpenParams,
 *   tpsl: hasTpOrSl
 *     ? { from: sessionKey, virtualAccount: predictedVa, subAccount,
 *         symbolId, positionType, quantity, pricePrecision, tp, sl }
 *     : undefined,
 * });
 * ```
 */
export function useInstantOpenWithTpSl(
  parameters: UseInstantOpenWithTpSlParameters = {},
): UseInstantOpenWithTpSlReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const openBase = instantOpenAutoMutationOptions(config);
  const tpslBase = setQuoteTpSlMutationOptions(config);
  const markConfirming = useTpSlStore((state) => state.markConfirming);

  const [phase, setPhase] = useState<UseInstantOpenWithTpSlPhase>("idle");

  const mutation = useMutation<UseInstantOpenWithTpSlData, SymmioRequestError, UseInstantOpenWithTpSlVariables>({
    mutationKey: ["useInstantOpenWithTpSl"] as const,
    mutationFn: async (variables) => {
      const resolvedChainId = variables.chainId ?? chainId;
      setPhase("opening");
      let openResult: InstantOpenReturnType;
      try {
        openResult = await openBase.mutationFn({ ...variables, chainId: resolvedChainId });
      } catch (err) {
        setPhase("error");
        throw normalizeSymmError(err);
      }

      // Refresh the instant-opens feed the moment the hedger accepts.
      const configKey = config.getChainConfigKey(resolvedChainId);
      void queryClient.invalidateQueries({ predicate: predicateMatch(getInstantOpensQueryKey, { configKey }) });

      const wantsTpSl = Boolean(variables.tpsl && (variables.tpsl.tp || variables.tpsl.sl));
      if (!wantsTpSl || !openResult.tempQuoteId) {
        setPhase("success");
        return { instantOpen: openResult };
      }

      const tempIdNumber = Number(openResult.tempQuoteId);
      if (!Number.isFinite(tempIdNumber)) {
        setPhase("success");
        return { instantOpen: openResult };
      }

      setPhase("attaching-tpsl");
      const quoteId = BigInt(tempIdNumber);
      try {
        const tpslResult = await tpslBase.mutationFn({
          ...(variables.tpsl as Omit<SetQuoteTpSlParameters, "quoteId" | "chainId">),
          chainId: resolvedChainId,
          quoteId,
        });
        // Mirror useSetQuoteTpSl.onSuccess: seed the confirming slot with the
        // target trigger price/type (not just the state) so useQuoteTpSl renders
        // the levels immediately — e.g. inline on the freshly-opened position row,
        // keyed by the tempQuoteId — instead of blank until the WS report lands.
        const tp = variables.tpsl!.tp;
        const sl = variables.tpsl!.sl;
        if (tp) {
          markConfirming(quoteId, "tp", {
            price: tp.triggerPrice,
            priceType: tp.priceType,
            cohQuoteId: tpslResult.cohQuoteId,
          });
        }
        if (sl) {
          markConfirming(quoteId, "sl", {
            price: sl.triggerPrice,
            priceType: sl.priceType,
            cohQuoteId: tpslResult.cohQuoteId,
          });
        }
        setPhase("success");
        return { instantOpen: openResult, tpsl: tpslResult };
      } catch (err) {
        // Instant open landed; only the TP/SL leg failed. Surface it on the
        // return payload rather than throwing, so callers can render a partial
        // success state without losing the trade.
        setPhase("success");
        return { instantOpen: openResult, tpslError: normalizeSymmError(err) };
      }
    },
    onError: () => setPhase("error"),
  }) as UseMutationResult<UseInstantOpenWithTpSlData, SymmioRequestError, UseInstantOpenWithTpSlVariables>;

  return Object.assign(mutation, { phase });
}
