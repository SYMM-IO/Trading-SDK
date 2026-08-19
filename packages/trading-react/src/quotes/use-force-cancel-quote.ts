"use client";

import {
  forceCancelQuoteMutationOptions,
  getPartyAOpenPositionsQueryKey,
  getPartyAPendingQuotesQueryKey,
  getPendingQuotesQueryKey,
  type ForceCancelQuoteParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/** Parameters for {@link useForceCancelQuote}. */
export type UseForceCancelQuoteParameters = WriteParameters;

/** Result returned by the {@link useForceCancelQuote} mutation. */
export type ForceCancelQuoteResult = WriteResult;

/** Return type of {@link useForceCancelQuote}. */
export type UseForceCancelQuoteReturnType = UseMutationResult<
  ForceCancelQuoteResult,
  SymmioRequestError,
  ForceCancelQuoteParameters
>;

/**
 * Force-cancel a stalled quote (`forceCancelQuote`, routed through the
 * AccountLayer `_call` proxy). Only valid once the quote is `CANCEL_PENDING`
 * (partyA already called `requestToCancelQuote` on a `LOCKED` order) **and** the
 * force-cancel cooldown has elapsed — see {@link useCoolDownsOfMA} (index 1) plus
 * the quote's `statusModifyTimestamp`. On success (after the receipt) the
 * subaccount's pending-quotes reads are invalidated so the order drops out.
 *
 * @example
 * ```tsx
 * const { mutate } = useForceCancelQuote();
 * mutate({ account: "0xsub…", quoteId: 42n });
 * ```
 */
export function useForceCancelQuote(parameters: UseForceCancelQuoteParameters = {}): UseForceCancelQuoteReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();

  const base = forceCancelQuoteMutationOptions(config);

  return useMutation<ForceCancelQuoteResult, SymmioRequestError, ForceCancelQuoteParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const hash = await base.mutationFn({
          account: variables.account,
          quoteId: variables.quoteId,
          from: variables.from,
          simulateBeforeWrite: variables.simulateBeforeWrite,
          chainId: resolvedChainId,
        });
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
      // The force-cancelled quote leaves the pending set — refetch the pending
      // reads (full quotes + ids) and the open positions for this partyA after the
      // receipt, so managed-quotes drops the now-terminal quote.
      const partial = { partyA: variables.account };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getPendingQuotesQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getPartyAPendingQuotesQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getPartyAOpenPositionsQueryKey, partial) });
    },
  });
}
