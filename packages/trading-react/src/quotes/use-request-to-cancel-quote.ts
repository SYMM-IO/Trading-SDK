"use client";

import {
  getPartyAPendingQuotesQueryKey,
  getPendingQuotesQueryKey,
  getQuoteQueryKey,
  requestToCancelQuoteMutationOptions,
  type RequestToCancelQuoteParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { invalidateAccountBalances, predicateMatch } from "../utils";

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
 * (after the receipt), the subaccount's pending-quotes reads and the quote's own
 * `getQuote` read are invalidated.
 *
 * The order only leaves the list immediately when it was `PENDING` (unlocked): the
 * contract cancels it outright. A `LOCKED` order instead moves to `CANCEL_PENDING`
 * and **stays** in `partyAPendingQuotes` until the solver calls
 * `acceptCancelRequest` — a transaction this mutation never sees and the
 * notifications stream never announces. `useManagedQuotes` and `useLimitOrders`
 * chase that on-chain, so a list fed by either drops the row on its own; a consumer
 * reading `getPartyAPendingQuotes` directly has to poll.
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
      /**
       * Refetch both pending reads (full quotes + ids) for this partyA, plus the
       * per-id `getQuote` hydration — that is the read carrying `quoteStatus`, so
       * without it a `useManagedQuotes` consumer keeps rendering the pre-cancel
       * status even after the id list refreshes.
       *
       * This fires on the receipt of the **request**, which only proves the quote
       * reached `CANCEL_PENDING` when it was `LOCKED`. The transaction that ends the
       * order is the solver's `acceptCancelRequest`, which is not announced on the
       * notifications stream; `useManagedQuotes` / `useLimitOrders` chase it from the
       * cancel notification instead.
       */
      const partial = { partyA: variables.account };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getPendingQuotesQueryKey, partial) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getPartyAPendingQuotesQueryKey, partial) });
      void queryClient.invalidateQueries({
        predicate: predicateMatch(getQuoteQueryKey, { quoteId: variables.quoteId }),
      });
      /**
       * Cancelling a `PENDING` quote refunds its open trading fee and releases the
       * margin it had reserved in the same transaction, so every balance read is now
       * stale. On the `LOCKED` branch nothing moves yet — the refund happens inside
       * the solver's later `acceptCancelRequest`, which no frame announces; the
       * cancel-confirm chase in `useManagedQuotes` re-reads the balances for that.
       */
      invalidateAccountBalances(queryClient, {
        configKey: config.getChainConfigKey(variables.chainId ?? chainId),
      });
    },
  });
}
