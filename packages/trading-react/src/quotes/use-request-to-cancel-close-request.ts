"use client";

import {
  getPartyAOpenPositionsQueryKey,
  requestToCancelCloseRequestMutationOptions,
  type RequestToCancelCloseRequestParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/** Parameters for {@link useRequestToCancelCloseRequest}. */
export type UseRequestToCancelCloseRequestParameters = WriteParameters;

/** Result returned by the {@link useRequestToCancelCloseRequest} mutation. */
export type RequestToCancelCloseRequestResult = WriteResult;

/** Return type of {@link useRequestToCancelCloseRequest}. */
export type UseRequestToCancelCloseRequestReturnType = UseMutationResult<
  RequestToCancelCloseRequestResult,
  SymmioRequestError,
  RequestToCancelCloseRequestParameters
>;

/**
 * Cancel a pending close (`requestToCancelCloseRequest`, routed through the
 * AccountLayer `_call` proxy) — how a partyA backs out of a resting close (e.g.
 * a limit close) while the quote is `CLOSE_PENDING`. If partyB accepts, the quote
 * returns to `OPENED`; if partyB stalls it enters `CANCEL_CLOSE_PENDING`, which
 * {@link useForceCancelCloseRequest} escalates once the cooldown passes. On
 * success (after the receipt) the subaccount's open-positions read is invalidated
 * so the row's status refreshes.
 *
 * @example
 * ```tsx
 * const { mutate } = useRequestToCancelCloseRequest();
 * mutate({ account: "0xsub…", quoteId: 42n });
 * ```
 */
export function useRequestToCancelCloseRequest(
  parameters: UseRequestToCancelCloseRequestParameters = {},
): UseRequestToCancelCloseRequestReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();

  const base = requestToCancelCloseRequestMutationOptions(config);

  return useMutation<RequestToCancelCloseRequestResult, SymmioRequestError, RequestToCancelCloseRequestParameters>({
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
      // The close-cancel flips the position out of CLOSE_PENDING — refetch the
      // owning partyA's open positions so the status updates.
      const partial = { partyA: variables.account };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getPartyAOpenPositionsQueryKey, partial) });
    },
  });
}
