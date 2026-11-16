"use client";
import {
  createLegacyConditionalOrderMutationOptions,
  type ConfigParameter,
  type CreateLegacyConditionalOrderParameters,
  type LegacyConditionalOrder,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Config override for {@link useCreateLegacyConditionalOrder}. */
export type UseCreateLegacyConditionalOrderParameters = ConfigParameter;
/** Request state and mutation controls for {@link useCreateLegacyConditionalOrder}. */
export type UseCreateLegacyConditionalOrderReturnType = UseMutationResult<
  LegacyConditionalOrder,
  SymmioRequestError,
  CreateLegacyConditionalOrderParameters
>;

/**
 * Submit a legacy bearer-authenticated conditional order; the host owns consent, token storage and refresh.
 * @param parameters - Optional SDK config override.
 * @returns Mutation state; call mutateAsync with the complete core action inputs.
 * @example const request = useCreateLegacyConditionalOrder();
 */
export function useCreateLegacyConditionalOrder(
  parameters: UseCreateLegacyConditionalOrderParameters = {},
): UseCreateLegacyConditionalOrderReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = createLegacyConditionalOrderMutationOptions(config);
  return useMutation({
    ...options,
    mutationFn: async (variables: CreateLegacyConditionalOrderParameters) => {
      try {
        return await options.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  });
}
