"use client";

import {
  getInstantClosesQueryKey,
  instantCloseAutoMutationOptions,
  type ConfigParameter,
  type InstantCloseReturnType,
  type PrepareInstantCloseParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { invalidateAccountBalances, predicateMatch } from "../utils";

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
 *   quoteId: 42n, quantityToClose: "0.5", slippage: 5, // ≥5%: source from user; 1% often fails to fill
 * });
 * ```
 */
export function useInstantCloseAuto(parameters: UseInstantCloseAutoParameters = {}): UseInstantCloseAutoReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
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
    onSuccess: (_result, variables) => {
      /**
       * A freshly submitted instant-close exists on the hedger but not in any
       * cached read yet. Invalidate the instant-closes feed so it refetches and the
       * closing row appears immediately — and so the managed-quotes consumer, which
       * polls the feed only while a close is in flight, fetches it once to bootstrap.
       */
      const configKey = config.getChainConfigKey(variables.chainId ?? chainId);
      void queryClient.invalidateQueries({ predicate: predicateMatch(getInstantClosesQueryKey, { configKey }) });
      /** A fill releases locked margin and realizes PnL — every balance read on this chain is now suspect. */
      invalidateAccountBalances(queryClient, { configKey });
    },
  });
}
