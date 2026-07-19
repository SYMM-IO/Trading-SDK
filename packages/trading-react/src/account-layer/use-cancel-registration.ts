"use client";

import {
  cancelRegistrationMutationOptions,
  getAffiliateStateQueryKey,
  type CancelRegistrationParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useCancelRegistration}.
 */
export type UseCancelRegistrationParameters = WriteParameters;

/**
 * Result returned by the {@link useCancelRegistration} mutation.
 */
export type CancelRegistrationResult = WriteResult;

/** Return type of {@link useCancelRegistration}. */
export type UseCancelRegistrationReturnType = UseMutationResult<
  CancelRegistrationResult,
  SymmioRequestError,
  CancelRegistrationParameters
>;

/**
 * Submit a `cancelRegistration` transaction to withdraw a still-`PENDING`
 * affiliate registration (caller must be the affiliate `admin`). On success, the
 * cancelled affiliate's `getAffiliateState` query is invalidated so mounted
 * status polls refetch.
 *
 * @example
 * ```tsx
 * const { mutate } = useCancelRegistration();
 * mutate({ affiliate: "0xaff…" });
 * ```
 */
export function useCancelRegistration(
  parameters: UseCancelRegistrationParameters = {},
): UseCancelRegistrationReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();

  const base = cancelRegistrationMutationOptions(config);

  return useMutation<CancelRegistrationResult, SymmioRequestError, CancelRegistrationParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const hash = await base.mutationFn({
          affiliate: variables.affiliate,
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
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        predicate: predicateMatch(getAffiliateStateQueryKey, { affiliate: variables.affiliate }),
      });
    },
  });
}
