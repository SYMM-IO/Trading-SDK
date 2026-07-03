"use client";

import {
  getInstantClosesQueryKey,
  instantCloseMutationOptions,
  type ConfigParameter,
  type InstantCloseParameters,
  type InstantCloseReturnType,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useInstantClose}.
 */
export type UseInstantCloseParameters = ConfigParameter;

/** Return type of {@link useInstantClose}. */
export type UseInstantCloseReturnType = UseMutationResult<
  InstantCloseReturnType,
  SymmioRequestError,
  InstantCloseParameters
>;

/**
 * Close (or partially close) a lowcap instant position via the pure
 * `instantClose` primitive.
 *
 * Every input is required — the SDK does no fetching. Use this hook when the
 * caller already has the slippage-adjusted close price and the wei quantity
 * to close in hand. For the friendlier "just give me the close intent" path,
 * use {@link useInstantCloseAuto}.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useInstantClose();
 * await mutateAsync({
 *   partyA: "0xva…",
 *   order: { quoteId: 42n, closePrice: 50_000n * 10n ** 18n, quantityToClose: 10n ** 18n },
 * });
 * ```
 */
export function useInstantClose(parameters: UseInstantCloseParameters = {}): UseInstantCloseReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const base = instantCloseMutationOptions(config);

  return useMutation<InstantCloseReturnType, SymmioRequestError, InstantCloseParameters>({
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
       * A freshly submitted instant-close exists on the hedger but not in any
       * cached read yet. Invalidate the instant-closes feed so it refetches and the
       * closing row appears immediately — and so the managed-quotes consumer, which
       * polls the feed only while a close is in flight, fetches it once to bootstrap.
       */
      const configKey = config.getChainConfigKey(variables.chainId ?? chainId);
      void queryClient.invalidateQueries({ predicate: predicateMatch(getInstantClosesQueryKey, { configKey }) });
    },
  });
}
