"use client";

import {
  getInstantOpensQueryKey,
  instantOpen,
  instantOpenAutoMutationOptions,
  prepareInstantOpenParams,
  setQuoteTpSlMutationOptions,
  SymmError,
  type ConfigParameter,
  type InstantOpenReturnType,
  type PrepareInstantOpenParameters,
  type SetQuoteTpSlParameters,
  type SetQuoteTpSlReturnType,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { useState } from "react";
import { formatUnits } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { useTpSlStore } from "../tpsl/tpsl-store";
import { invalidateAccountBalances, predicateMatch } from "../utils";

/**
 * Parameters for {@link useInstantOpenWithTpSl}: the standard instant-open
 * inputs, plus an optional `tpsl` block that mirrors {@link SetQuoteTpSlParameters}
 * minus `quoteId` (derived from the hedger response) and `chainId` (defaulted).
 *
 * When `tpsl` is omitted (or both `tp` and `sl` are empty), the hook behaves
 * exactly like {@link useInstantOpenAuto}. When present, the SDK dispatches
 * `setQuoteTpSl` immediately after the hedger returns a `tempQuoteId` — the
 * message is signed against the (predicted) VA the caller supplies, so no
 * on-chain reconciliation wait is needed. Acceptance is separate from observed
 * order state. Consumers can use the SDK store or own REST reconciliation.
 */
export interface UseInstantOpenWithTpSlVariables extends PrepareInstantOpenParameters {
  tpsl?: Omit<SetQuoteTpSlParameters, "quoteId" | "chainId">;
  /** Use the exact submitted size for attachment, or retain the provided quantity (default). */
  tpslQuantityMode?: "provided" | "prepared";
}

/** Aggregated success payload from {@link useInstantOpenWithTpSl}. */
export interface UseInstantOpenWithTpSlData {
  instantOpen: InstantOpenReturnType;
  /** Set when the TP/SL leg was attempted and succeeded. */
  tpsl?: SetQuoteTpSlReturnType;
  /** Set when the TP/SL leg was attempted and failed — instant open still landed. */
  tpslError?: SymmioRequestError;
  /** Resolved attachment inputs, including on failure. Contains no signature. */
  tpslParameters?: SetQuoteTpSlParameters;
}

/** Which leg the orchestrator is currently on. */
export type UseInstantOpenWithTpSlPhase = "idle" | "opening" | "attaching-tpsl" | "success" | "error";

/** Parameters for {@link useInstantOpenWithTpSl}. */
export type UseInstantOpenWithTpSlParameters = ConfigParameter & {
  /** "external" leaves TP/SL optimism/reconciliation to the consumer. Defaults to "sdk". */
  tpslState?: "sdk" | "external";
};

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
 * open/balance invalidation and optional confirming-slot write) lives in the SDK.
 *
 * Funding follows the `PrepareInstantOpenParameters` one-of: a typed
 * `initialMargin`, or `fund: { mode: "full-balance", balance }` (lowcap only)
 * to deploy the whole balance. In full-balance mode the submitted quantity is
 * the SDK-rescaled one. Select `tpslQuantityMode: "prepared"` to use that exact
 * submitted quantity, even when a prior preview differs.
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
    retry: false,
    mutationFn: async (variables) => {
      const resolvedChainId = variables.chainId ?? chainId;
      setPhase("opening");
      let openResult: InstantOpenReturnType;
      let quantity = variables.tpsl?.quantity;
      try {
        if (variables.tpslQuantityMode === "prepared" && variables.tpsl) {
          const prepared = await prepareInstantOpenParams(config, { ...variables, chainId: resolvedChainId });
          quantity = formatUnits(prepared.order.quantity, 18);
          openResult = await instantOpen(config, prepared);
        } else {
          openResult = await openBase.mutationFn({ ...variables, chainId: resolvedChainId });
        }
      } catch (err) {
        setPhase("error");
        throw normalizeSymmError(err);
      }

      // Refresh the instant-opens feed the moment the hedger accepts.
      const configKey = config.getChainConfigKey(resolvedChainId);
      void queryClient.invalidateQueries({ predicate: predicateMatch(getInstantOpensQueryKey, { configKey }) });
      /** The open locks margin and charges a fee — every balance read on this chain is now suspect. */
      invalidateAccountBalances(queryClient, { configKey });

      const wantsTpSl = Boolean(variables.tpsl && (variables.tpsl.tp || variables.tpsl.sl));
      if (!wantsTpSl) {
        setPhase("success");
        return { instantOpen: openResult };
      }

      const tempIdNumber = Number(openResult.tempQuoteId);
      if (!Number.isSafeInteger(tempIdNumber) || tempIdNumber === 0) {
        setPhase("success");
        return {
          instantOpen: openResult,
          tpslError: normalizeSymmError(
            new SymmError(
              "validation",
              "INSTANT_OPEN_TPSL_INVALID_ID",
              "Open accepted but attachment quote ID is missing or unsafe.",
            ),
          ),
        };
      }

      setPhase("attaching-tpsl");
      const quoteId = BigInt(tempIdNumber);
      const tpslParameters: SetQuoteTpSlParameters = {
        ...variables.tpsl!,
        quantity: quantity!,
        chainId: resolvedChainId,
        quoteId,
      };
      try {
        const tpslResult = await tpslBase.mutationFn(tpslParameters);
        // Mirror useSetQuoteTpSl.onSuccess: seed the confirming slot with the
        // target trigger price/type (not just the state) so useQuoteTpSl renders
        // the levels immediately — e.g. inline on the freshly-opened position row,
        // keyed by the tempQuoteId — instead of blank until the WS report lands.
        const tp = variables.tpsl!.tp;
        const sl = variables.tpsl!.sl;
        if (tp && parameters.tpslState !== "external") {
          markConfirming(quoteId, "tp", {
            price: tp.triggerPrice,
            pricePrecision: variables.tpsl!.pricePrecision,
            priceType: tp.priceType,
            cohQuoteId: tpslResult.cohQuoteId,
          });
        }
        if (sl && parameters.tpslState !== "external") {
          markConfirming(quoteId, "sl", {
            price: sl.triggerPrice,
            pricePrecision: variables.tpsl!.pricePrecision,
            priceType: sl.priceType,
            cohQuoteId: tpslResult.cohQuoteId,
          });
        }
        setPhase("success");
        return { instantOpen: openResult, tpsl: tpslResult, tpslParameters };
      } catch (err) {
        // Instant open landed; only the TP/SL leg failed. Surface it on the
        // return payload rather than throwing, so callers can render a partial
        // success state without losing the trade.
        setPhase("success");
        return { instantOpen: openResult, tpslError: normalizeSymmError(err), tpslParameters };
      }
    },
    onError: () => setPhase("error"),
  }) as UseMutationResult<UseInstantOpenWithTpSlData, SymmioRequestError, UseInstantOpenWithTpSlVariables>;

  return Object.assign(mutation, { phase });
}
