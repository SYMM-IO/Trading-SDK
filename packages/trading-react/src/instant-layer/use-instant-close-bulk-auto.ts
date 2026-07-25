"use client";

import {
  getInstantClosesQueryKey,
  instantCloseBulkAutoMutationOptions,
  type ConfigParameter,
  type InstantCloseBulkAutoParameters,
  type InstantCloseBulkReturnType,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { predicateMatch } from "../utils";

/** Parameters for {@link useInstantCloseBulkAuto}. */
export type UseInstantCloseBulkAutoParameters = ConfigParameter;

/** Return type of {@link useInstantCloseBulkAuto}. */
export type UseInstantCloseBulkAutoReturnType = UseMutationResult<
  InstantCloseBulkReturnType,
  SymmioRequestError,
  InstantCloseBulkAutoParameters
>;

/**
 * Close multiple lowcap instant positions in one solver round-trip, deriving
 * each order's wei fields from UI-shape inputs (market id, slippage, mark
 * price, …) via `prepareInstantCloseParams`. Friendly default for "close-all"
 * flows.
 *
 * @example
 * ```tsx
 * const { mutateAsync } = useInstantCloseBulkAuto();
 * await mutateAsync({
 *   from: sessionKey,
 *   orders: [
 *     { partyA, market: { id: 1 }, positionType: PositionType.LONG, quoteId: 1n, quantityToClose: "0.5", slippage: 5 },
 *   ],
 * });
 * ```
 */
export function useInstantCloseBulkAuto(
  parameters: UseInstantCloseBulkAutoParameters = {},
): UseInstantCloseBulkAutoReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const base = instantCloseBulkAutoMutationOptions(config);

  return useMutation<InstantCloseBulkReturnType, SymmioRequestError, InstantCloseBulkAutoParameters>({
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
