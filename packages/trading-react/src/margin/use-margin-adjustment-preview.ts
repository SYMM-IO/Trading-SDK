"use client";

import {
  getMarginAdjustmentPreviewQueryOptions,
  type ConfigParameter,
  type GetMarginAdjustmentPreviewParameters,
  type MarginAdjustmentPreview,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useEffect, useReducer } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Explicit preview identity with an enable guard for modal lifecycle. */
export type UseMarginAdjustmentPreviewParameters = GetMarginAdjustmentPreviewParameters &
  ConfigParameter & { enabled?: boolean };
/** Query state; a failed preview has no usable financial result. */
export type UseMarginAdjustmentPreviewReturnType = UseQueryResult<MarginAdjustmentPreview, SymmioRequestError> & {
  /** False once the supplied mark expires, even if no new feed event arrives. */
  isFresh: boolean;
};

/**
 * Query an SDK-owned margin preview. It never keeps data from a different key
 * and introduces no polling tier. Fetch again immediately before submission.
 * @param parameters - Identity, mark, amount and configuration.
 * @returns Preview, loading and normalized error state.
 * @example
 * const preview = useMarginAdjustmentPreview({ ...parameters, enabled: isOpen });
 */
export function useMarginAdjustmentPreview(
  parameters: UseMarginAdjustmentPreviewParameters,
): UseMarginAdjustmentPreviewReturnType {
  const { config: explicitConfig, enabled, ...inputs } = parameters;
  const config = useSymmioConfig({ config: explicitConfig });
  const options = getMarginAdjustmentPreviewQueryOptions(config, inputs);
  const query = useQuery<MarginAdjustmentPreview, SymmioRequestError>({
    ...options,
    enabled,
    // A host-wide keepPreviousData default must not leak another VA's figures.
    placeholderData: undefined,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  });
  const [, refresh] = useReducer((count: number) => count + 1, 0);
  const expiresAt = parameters.mark ? parameters.mark.updatedAt + parameters.maxPriceAgeMs : 0;
  useEffect(() => {
    const delay = expiresAt - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) return;
    const timer = setTimeout(refresh, Math.min(delay, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [expiresAt]);
  return { ...query, isFresh: expiresAt > Date.now() };
}
