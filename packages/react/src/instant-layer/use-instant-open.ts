"use client";

import {
  getInstantOpensQueryKey,
  instantOpenMutationOptions,
  type ConfigParameter,
  type InstantOpenParameters,
  type InstantOpenReturnType,
} from "@theoldvarorg/core";
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

/** Return type of {@link useInstantOpen}. */
export type UseInstantOpenReturnType = UseMutationResult<
  InstantOpenReturnType,
  SymmioRequestError,
  InstantOpenParameters
>;

/**
 * Open a lowcap instant position via the pure `instantOpen` primitive.
 *
 * Every input is required — the SDK does no fetching. Use this hook when the
 * caller already has market metadata, locked params, mark price, and fee
 * rates in hand (e.g. pre-fetched via `useMarkets`, `useLockedParams`,
 * `useEnigmaPriceServicePricesByNames`, `useFeeForUser`). For the friendlier
 * "just give me the trade intent" path, use {@link useInstantOpenAuto}.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useInstantOpen();
 * const { tempQuoteId } = await mutateAsync({
 *   walletAddress, sessionKeyAddress, signTypedData,
 *   marketId: 1, marketName: "BTCUSDT", pricePrecision: 2, quantityPrecision: 3,
 *   positionType: "LONG", userInput: "100", leverage: 5, slippage: 1,
 *   cvaPercent: "2", lfPercent: "1", partyAmmPercent: "3", partyBmmPercent: "3",
 *   markPrice: "50000",
 *   feeRates: { openFee: feeQuery.data.openFee, closeFee: feeQuery.data.closeFee },
 * });
 * ```
 */
export function useInstantOpen(parameters: UseInstantOpenParameters = {}): UseInstantOpenReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const base = instantOpenMutationOptions(config);

  return useMutation<InstantOpenReturnType, SymmioRequestError, InstantOpenParameters>({
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
