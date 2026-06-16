"use client";

import {
  instantCloseAutoMutationOptions,
  type ConfigParameter,
  type InstantCloseReturnType,
  type PrepareInstantCloseParameters,
} from "@symm-frontier/core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useInstantCloseAuto}.
 */
export type UseInstantCloseAutoParameters = ConfigParameter;

/** Return type of {@link useInstantCloseAuto}. */
export type UseInstantCloseAutoReturnType = UseMutationResult<
  InstantCloseReturnType,
  SymmioRequestError,
  PrepareInstantCloseParameters
>;

/**
 * Close (or partially close) a lowcap instant position via the wizard
 * `instantCloseAuto` action.
 *
 * Friendly default: accepts the minimal close intent and lets the SDK fetch
 * market metadata + mark price. Pre-fill `markPrice` to skip its fetch. For
 * full control — inspect / mutate resolved params between fetch and submit —
 * use {@link useInstantClose} after calling `prepareInstantCloseParams` directly.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useInstantCloseAuto();
 * await mutateAsync({
 *   partyA, market: { id: 1 }, positionType: PositionType.LONG,
 *   quoteId: 42n, quantityToClose: "0.5", slippage: 1,
 * });
 * ```
 */
export function useInstantCloseAuto(parameters: UseInstantCloseAutoParameters = {}): UseInstantCloseAutoReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const base = instantCloseAutoMutationOptions(config);

  return useMutation<InstantCloseReturnType, SymmioRequestError, PrepareInstantCloseParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        return await base.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  });
}
