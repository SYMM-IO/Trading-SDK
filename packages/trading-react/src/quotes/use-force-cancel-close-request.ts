"use client";

import {
  forceCancelCloseRequestMutationOptions,
  getPartyAOpenPositionsQueryKey,
  type ForceCancelCloseRequestParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/** Parameters for {@link useForceCancelCloseRequest}. */
export type UseForceCancelCloseRequestParameters = WriteParameters;

/** Result returned by the {@link useForceCancelCloseRequest} mutation. */
export type ForceCancelCloseRequestResult = WriteResult;

/** Return type of {@link useForceCancelCloseRequest}. */
export type UseForceCancelCloseRequestReturnType = UseMutationResult<
  ForceCancelCloseRequestResult,
  SymmioRequestError,
  ForceCancelCloseRequestParameters
>;

/**
 * Force-cancel a stalled pending close (`forceCancelCloseRequest`, routed through
 * the AccountLayer `_call` proxy). Only valid once the quote is
 * `CANCEL_CLOSE_PENDING` (partyA already called `requestToCancelCloseRequest` and
 * partyB never acted) **and** the force-cancel-close cooldown has elapsed — see
 * {@link useCoolDownsOfMA} (index 2) plus the quote's `statusModifyTimestamp`. The
 * quote returns to `OPENED`. On success (after the receipt) the subaccount's
 * open-positions read is invalidated.
 *
 * @example
 * ```tsx
 * const { mutate } = useForceCancelCloseRequest();
 * mutate({ account: "0xsub…", quoteId: 42n });
 * ```
 */
export function useForceCancelCloseRequest(
  parameters: UseForceCancelCloseRequestParameters = {},
): UseForceCancelCloseRequestReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();

  const base = forceCancelCloseRequestMutationOptions(config);

  return useMutation<ForceCancelCloseRequestResult, SymmioRequestError, ForceCancelCloseRequestParameters>({
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
      // The force-cancel returns the position to OPENED — refetch the owning
      // partyA's open positions so the status updates.
      const partial = { partyA: variables.account };
      void queryClient.invalidateQueries({ predicate: predicateMatch(getPartyAOpenPositionsQueryKey, partial) });
    },
  });
}
