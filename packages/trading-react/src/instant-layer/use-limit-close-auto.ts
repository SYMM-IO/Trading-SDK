"use client";

import {
  getInstantClosesQueryKey,
  limitCloseAutoMutationOptions,
  type ConfigParameter,
  type InstantCloseReturnType,
  type PrepareLimitCloseParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { invalidateAccountBalances, predicateMatch } from "../utils";

/** Parameters for {@link useLimitCloseAuto}. */
export type UseLimitCloseAutoParameters = ConfigParameter;

/** Return type of {@link useLimitCloseAuto}. */
export type UseLimitCloseAutoReturnType = UseMutationResult<
  InstantCloseReturnType,
  SymmioRequestError,
  PrepareLimitCloseParameters
>;

/**
 * Submit a **LIMIT close** request (majors / rasa) via the `limitCloseAuto`
 * action.
 *
 * Accepts the minimal close intent plus the user's resting `price`; the SDK
 * resolves market metadata, clamps the quantity, signs it with
 * `orderType = LIMIT`, and posts it to the solver, which writes a **pending
 * close** resting at that price. Throws `UNSUPPORTED_BY_SOLVER` when the
 * resolved solver has no limit-order support — gate the UI with
 * `useSupportsLimitOrder`.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useLimitCloseAuto();
 * await mutateAsync({
 *   partyA, from,
 *   market: { id: 1 }, positionType: PositionType.LONG,
 *   quoteId: 42n, quantityToClose: "0.5", price: "64000",
 * });
 * ```
 */
export function useLimitCloseAuto(parameters: UseLimitCloseAutoParameters = {}): UseLimitCloseAutoReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const base = limitCloseAutoMutationOptions(config);

  return useMutation<InstantCloseReturnType, SymmioRequestError, PrepareLimitCloseParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        return await base.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: (_result, variables) => {
      // The accepted limit close lands in the hedger's instant-closes feed before
      // it anchors on-chain — invalidate that feed so the resting close surfaces
      // without waiting for a poll.
      const configKey = config.getChainConfigKey(variables.chainId ?? chainId);
      void queryClient.invalidateQueries({ predicate: predicateMatch(getInstantClosesQueryKey, { configKey }) });
      /** A fill releases locked margin and realizes PnL — every balance read on this chain is now suspect. */
      invalidateAccountBalances(queryClient, { configKey });
    },
  });
}
