"use client";

import {
  getInstantOpensQueryKey,
  instantOpenMutationOptions,
  type ConfigParameter,
  type InstantOpenParameters,
  type InstantOpenReturnType,
  type SymmioSolverKind,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useInstantOpen}.
 */
export type UseInstantOpenParameters = ConfigParameter;

/** Return type of {@link useInstantOpen}, narrowed by the target solver kind `K`. */
export type UseInstantOpenReturnType<K extends SymmioSolverKind = SymmioSolverKind> = UseMutationResult<
  InstantOpenReturnType<K>,
  SymmioRequestError,
  InstantOpenParameters<K>
>;

/**
 * Open an instant position via the pure `instantOpen` primitive.
 *
 * Every value is already final wei — the SDK does no fetching or math here. Use
 * this hook when the caller already has market metadata, locked params, mark
 * price, and fee rates in hand. For the friendlier "just give me the trade
 * intent" path, use {@link useInstantOpenAuto}.
 *
 * The submitted shape depends on the solver: **Enigma (lowcap)** funds a fresh
 * virtual account, so `margin` is required; **Rasa (majors)** is cross-margin,
 * ignores `margin`, and fetches a live Muon signature before signing. The result
 * is discriminated on `kind`. Bind the generic to keep it narrowed for a hook
 * that always targets one solver.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useInstantOpen<"rasa">();
 * const { tempQuoteId, rfq } = await mutateAsync({
 *   solverId: "rasa",
 *   subAccountAddress,
 *   marketId: 1,
 *   positionType: PositionType.LONG,
 *   order: { price, quantity },
 *   lockedParam: { cva, lf, partyAmm, partyBmm },
 * });
 * ```
 */
export function useInstantOpen<K extends SymmioSolverKind = SymmioSolverKind>(
  parameters: UseInstantOpenParameters = {},
): UseInstantOpenReturnType<K> {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const base = instantOpenMutationOptions<K>(config);

  return useMutation<InstantOpenReturnType<K>, SymmioRequestError, InstantOpenParameters<K>>({
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
