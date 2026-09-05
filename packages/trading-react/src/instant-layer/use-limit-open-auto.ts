"use client";

import {
  getInstantOpensQueryKey,
  limitOpenAutoMutationOptions,
  type ConfigParameter,
  type InstantOpenReturnType,
  type PrepareLimitOpenParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { invalidateAccountBalances, predicateMatch } from "../utils";

/** Parameters for {@link useLimitOpenAuto}. */
export type UseLimitOpenAutoParameters = ConfigParameter;

/** Return type of {@link useLimitOpenAuto}. */
export type UseLimitOpenAutoReturnType = UseMutationResult<
  InstantOpenReturnType,
  SymmioRequestError,
  PrepareLimitOpenParameters
>;

/**
 * Place a LIMIT open (majors / rasa) via the `limitOpenAuto` action.
 *
 * Accepts the minimal trade intent plus the user's resting `price`; the SDK
 * resolves market metadata, locked params, and fee rates, sizes the order, signs
 * it, and posts it to the solver, which writes a **pending** on-chain quote. The
 * order then appears in the on-chain pending list (`getPartyAPendingQuotes`),
 * which this hook invalidates on success. Throws `UNSUPPORTED_BY_SOLVER` when the
 * resolved solver has no limit-order support — gate the UI with
 * `useSupportsLimitOrder`.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useLimitOpenAuto();
 * await mutateAsync({
 *   subAccountAddress, from,
 *   market: { id: 1 }, positionType: "LONG",
 *   initialMargin: "100", leverage: 5, price: "64000",
 * });
 * ```
 */
export function useLimitOpenAuto(parameters: UseLimitOpenAutoParameters = {}): UseLimitOpenAutoReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const base = limitOpenAutoMutationOptions(config);

  return useMutation<InstantOpenReturnType, SymmioRequestError, PrepareLimitOpenParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        return await base.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: (_result, variables) => {
      // The hedger lists the accepted limit order in its instant-open feed before
      // it anchors on-chain — invalidate that feed so `useLimitOrders` shows the
      // off-chain row instantly; the on-chain read then flips it to on-chain via
      // the anchor notification.
      const configKey = config.getChainConfigKey(variables.chainId ?? chainId);
      void queryClient.invalidateQueries({ predicate: predicateMatch(getInstantOpensQueryKey, { configKey }) });
      /** The open locks margin and charges a fee — every balance read on this chain is now suspect. */
      invalidateAccountBalances(queryClient, { configKey });
    },
  });
}
