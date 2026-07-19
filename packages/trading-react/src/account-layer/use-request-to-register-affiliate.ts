"use client";

import {
  getAffiliateStateQueryKey,
  requestToRegisterAffiliateMutationOptions,
  type RequestToRegisterAffiliateParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useRequestToRegisterAffiliate}.
 */
export type UseRequestToRegisterAffiliateParameters = WriteParameters;

/**
 * Result returned by the {@link useRequestToRegisterAffiliate} mutation.
 */
export type RequestToRegisterAffiliateResult = WriteResult;

/** Return type of {@link useRequestToRegisterAffiliate}. */
export type UseRequestToRegisterAffiliateReturnType = UseMutationResult<
  RequestToRegisterAffiliateResult,
  SymmioRequestError,
  RequestToRegisterAffiliateParameters
>;

/**
 * Submit a `requestToRegisterAffiliate` transaction — the permissionless
 * on-chain request that creates a `PENDING` affiliate awaiting approval. On
 * success, every `getAffiliateState` query is invalidated so any mounted status
 * poll refetches.
 *
 * The registration is faithful to the contract tuple: `stakeholders` shares plus
 * `symmioShare` must sum to `1e18`. Derive the resulting affiliate address with
 * `useGeneratedAccountManagerAddress` (a write cannot return it).
 *
 * @example
 * ```tsx
 * const { mutate, status, error } = useRequestToRegisterAffiliate();
 * mutate({
 *   registration: {
 *     name: "Acme",
 *     brandColor: "#ff5c39",
 *     admin,
 *     stakeholders: [{ receiver: admin, share: 900000000000000000n }],
 *     symmioShare: 100000000000000000n,
 *     metadata: "0x",
 *     legacyMultiAccounts: [],
 *     symmioCores: [core],
 *   },
 * });
 * ```
 */
export function useRequestToRegisterAffiliate(
  parameters: UseRequestToRegisterAffiliateParameters = {},
): UseRequestToRegisterAffiliateReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();

  const base = requestToRegisterAffiliateMutationOptions(config);

  return useMutation<RequestToRegisterAffiliateResult, SymmioRequestError, RequestToRegisterAffiliateParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const resolvedChainId = variables.chainId ?? chainId;
        const hash = await base.mutationFn({
          registration: variables.registration,
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ predicate: predicateMatch(getAffiliateStateQueryKey) });
    },
  });
}
