"use client";

import {
  forceCloseAutoMutationOptions,
  getPartyAOpenPositionsQueryKey,
  type ForceCloseAutoParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/** Parameters for {@link useForceClose}. */
export type UseForceCloseParameters = WriteParameters;

/** Result returned by the {@link useForceClose} mutation. */
export type ForceCloseResult = WriteResult;

/** Return type of {@link useForceClose}. */
export type UseForceCloseReturnType = UseMutationResult<ForceCloseResult, SymmioRequestError, ForceCloseAutoParameters>;

/**
 * Force-close a stalled `CLOSE_PENDING` **limit** position end-to-end from just a
 * `quoteId` (`forceCloseAuto`): read the quote + force-close params, gate on
 * eligibility, find a price window from reference candles, fetch the Muon
 * `HighLowPriceSig`, preflight the gap, and send `forceClosePosition` through the
 * AccountLayer `_call` proxy. On success (after the receipt) the subaccount's
 * open-positions read is invalidated so the row updates.
 *
 * Throws (normalized) on ineligibility (`FORCE_CLOSE_NOT_ELIGIBLE`), the market
 * not having hit the price (`FORCE_CLOSE_PRICE_NOT_REACHED`), or a contract
 * revert. Gate the button first with {@link useForceCloseEligibility}.
 *
 * @example
 * ```tsx
 * const forceClose = useForceClose();
 * forceClose.mutate({ account: "0xsub…", quoteId: 42n });
 * ```
 */
export function useForceClose(parameters: UseForceCloseParameters = {}): UseForceCloseReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();

  const base = forceCloseAutoMutationOptions(config);

  return useMutation<ForceCloseResult, SymmioRequestError, ForceCloseAutoParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const hash = await base.mutationFn({ ...variables, chainId: resolvedChainId });
        return resolveWriteResult(config, hash, {
          chainId: resolvedChainId,
          waitForReceipt: parameters.waitForReceipt,
          confirmations: parameters.confirmations,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: (_result, variables) => {
      // The force-close transitions the position — refetch the owning partyA's
      // open positions so the status updates.
      const partial = { partyA: variables.account };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getPartyAOpenPositionsQueryKey, partial) });
    },
  });
}
