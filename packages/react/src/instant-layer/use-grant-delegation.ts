"use client";

import {
  getDelegationExpiryQueryKey,
  getIsDelegationActiveQueryKey,
  grantDelegationMutationOptions,
  type GrantDelegationParameters,
} from "@symm-frontier/core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/**
 * Parameters for {@link useGrantDelegation}.
 */
export type UseGrantDelegationParameters = WriteParameters;

/**
 * Result returned by the {@link useGrantDelegation} mutation.
 */
export type GrantDelegationResult = WriteResult;

/** Return type of {@link useGrantDelegation}. */
export type UseGrantDelegationReturnType = UseMutationResult<
  GrantDelegationResult,
  SymmioRequestError,
  GrantDelegationParameters
>;

/**
 * Submit an Instant Layer `grantDelegation` transaction. On success, delegation
 * access queries for the account/delegated signer are invalidated.
 *
 * @example
 * ```tsx
 * const { mutate } = useGrantDelegation();
 * mutate({ account: { addr: account, isPartyB: false }, delegatedSigner, selectors, expiryTimestamp });
 * ```
 */
export function useGrantDelegation(parameters: UseGrantDelegationParameters = {}): UseGrantDelegationReturnType {
  const config = useSymmioConfig(parameters);
  const queryClient = useQueryClient();

  const base = grantDelegationMutationOptions(config);

  return useMutation<GrantDelegationResult, SymmioRequestError, GrantDelegationParameters>({
    mutationKey: base.mutationKey,
    mutationFn: async (variables) => {
      try {
        const hash = await base.mutationFn(variables);
        return resolveWriteResult(config, hash, {
          chainId: variables.chainId,
          waitForReceipt: parameters.waitForReceipt,
          confirmations: parameters.confirmations,
        });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        predicate: predicateMatch(getDelegationExpiryQueryKey, {
          account: variables.account.addr,
          delegate: variables.delegatedSigner,
        }),
      });
      void queryClient.invalidateQueries({
        predicate: predicateMatch(getIsDelegationActiveQueryKey, {
          account: variables.account.addr,
          delegate: variables.delegatedSigner,
        }),
      });
    },
  });
}
