"use client";

import {
  getPartyAPendingQuotesQueryKey,
  getPendingQuotesQueryKey,
  requestToCancelQuoteMutationOptions,
  type RequestToCancelQuoteParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/** Parameters for {@link useRequestToCancelQuote}. */
export type UseRequestToCancelQuoteParameters = WriteParameters;

/** Result returned by the {@link useRequestToCancelQuote} mutation. */
export type RequestToCancelQuoteResult = WriteResult;

/** Return type of {@link useRequestToCancelQuote}. */
export type UseRequestToCancelQuoteReturnType = UseMutationResult<
  RequestToCancelQuoteResult,
  SymmioRequestError,
  RequestToCancelQuoteParameters
>;

/**
 * Cancel a pending quote (`requestToCancelQuote`, routed through the AccountLayer
 * `_call` proxy) — how a partyA cancels a resting **LIMIT order**. On success
 * (after the receipt), the subaccount's pending-quotes reads are invalidated so
 * the cancelled order drops out of the list.
 *
 * @example
 * ```tsx
 * const { mutate } = useRequestToCancelQuote();
 * mutate({ account: "0xsub…", quoteId: 42n });
 * ```
 */
export function useRequestToCancelQuote(
  parameters: UseRequestToCancelQuoteParameters = {},
): UseRequestToCancelQuoteReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();

  const base = requestToCancelQuoteMutationOptions(config);

  return useMutation<RequestToCancelQuoteResult, SymmioRequestError, RequestToCancelQuoteParameters>({
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
      // The cancelled quote leaves the pending set — refetch both pending reads
      // (full quotes + ids) for this partyA after the receipt.
      const partial = { partyA: variables.account };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getPendingQuotesQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getPartyAPendingQuotesQueryKey, partial) });
    },
  });
}
