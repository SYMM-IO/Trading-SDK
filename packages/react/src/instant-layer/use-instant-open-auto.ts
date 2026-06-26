"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import {
  getInstantOpensQueryKey,
  instantOpenAutoMutationOptions,
  type ConfigParameter,
  type InstantOpenReturnType,
  type PrepareInstantOpenParameters,
} from "@theoldvarorg/core";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useInstantOpenAuto}.
 */
export type UseInstantOpenAutoParameters = ConfigParameter;

/** Return type of {@link useInstantOpenAuto}. */
export type UseInstantOpenAutoReturnType = UseMutationResult<
  InstantOpenReturnType,
  SymmioRequestError,
  PrepareInstantOpenParameters
>;

/**
 * Open a lowcap instant position via the wizard `instantOpenAuto` action.
 *
 * Friendly default: accepts the minimal trade intent and lets the SDK fetch
 * market metadata, mark price, locked params, and fee rates. Pre-fill any
 * optional field on the variables (e.g. cache-hot `markPrice`) to skip its
 * fetch. For full control — inspect / mutate resolved params between fetch and
 * submit — use {@link useInstantOpen} after calling
 * `prepareInstantOpenParams(config, …)` directly.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useInstantOpenAuto();
 * await mutateAsync({
 *   walletAddress, sessionKeyAddress, signTypedData,
 *   marketId: 1, positionType: "LONG",
 *   userInput: "100", leverage: 5, slippage: 1,
 * });
 * ```
 */
export function useInstantOpenAuto(parameters: UseInstantOpenAutoParameters = {}): UseInstantOpenAutoReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const base = instantOpenAutoMutationOptions(config);

  return useMutation<InstantOpenReturnType, SymmioRequestError, PrepareInstantOpenParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        return await base.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: (_result, variables) => {
      /**
       * A freshly submitted instant-open exists on the hedger but not in any
       * cached read yet. Invalidate the instant-opens feed so it refetches and
       * the optimistic row appears immediately — without waiting for a poll.
       */
      const configKey = config.getChainConfigKey(variables.chainId ?? chainId);
      void queryClient.invalidateQueries({ predicate: predicateMatch(getInstantOpensQueryKey, { configKey }) });
    },
  });
}
