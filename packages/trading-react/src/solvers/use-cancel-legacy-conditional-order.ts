"use client";
import {
  cancelLegacyConditionalOrderMutationOptions,
  type CancelLegacyConditionalOrderParameters,
  type ConfigParameter,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Config override for {@link useCancelLegacyConditionalOrder}. */
export type UseCancelLegacyConditionalOrderParameters = ConfigParameter;
/** Request state and mutation controls for {@link useCancelLegacyConditionalOrder}. */
export type UseCancelLegacyConditionalOrderReturnType = UseMutationResult<
  boolean,
  SymmioRequestError,
  CancelLegacyConditionalOrderParameters
>;

/**
 * Cancel a legacy bearer-authenticated conditional order; the host owns consent, token storage and refresh.
 * @param parameters - Optional SDK config override.
 * @returns Mutation state; call mutateAsync with the complete core action inputs.
 * @example const request = useCancelLegacyConditionalOrder();
 */
export function useCancelLegacyConditionalOrder(
  parameters: UseCancelLegacyConditionalOrderParameters = {},
): UseCancelLegacyConditionalOrderReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = cancelLegacyConditionalOrderMutationOptions(config);
  return useMutation({
    ...options,
    mutationFn: async (variables: CancelLegacyConditionalOrderParameters) => {
      try {
        return await options.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  });
}
