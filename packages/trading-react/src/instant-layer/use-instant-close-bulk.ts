"use client";

import {
  getInstantClosesQueryKey,
  instantCloseBulkMutationOptions,
  type ConfigParameter,
  type InstantCloseBulkParameters,
  type InstantCloseBulkReturnType,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { predicateMatch } from "../utils";

/** Parameters for {@link useInstantCloseBulk}. */
export type UseInstantCloseBulkParameters = ConfigParameter;

/** Return type of {@link useInstantCloseBulk}. */
export type UseInstantCloseBulkReturnType = UseMutationResult<
  InstantCloseBulkReturnType,
  SymmioRequestError,
  InstantCloseBulkParameters
>;

/**
 * Close multiple lowcap instant positions in one solver round-trip. Every
 * input order must already carry wei-shape fields (`closePrice`,
 * `quantityToClose`); use {@link useInstantCloseBulkAuto} when you want the SDK
 * to derive those from UI-shape inputs.
 *
 * Invalidates the instant-closes feed on success so the closing rows appear in
 * the consumer's quote list immediately.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useInstantCloseBulk();
 * await mutateAsync({ from: sessionKey, orders: [...] });
 * ```
 */
export function useInstantCloseBulk(parameters: UseInstantCloseBulkParameters = {}): UseInstantCloseBulkReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const base = instantCloseBulkMutationOptions(config);

  return useMutation<InstantCloseBulkReturnType, SymmioRequestError, InstantCloseBulkParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        return await base.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: (_result, variables) => {
      const configKey = config.getChainConfigKey(variables.chainId ?? chainId);
      void queryClient.invalidateQueries({ predicate: predicateMatch(getInstantClosesQueryKey, { configKey }) });
    },
  });
}
