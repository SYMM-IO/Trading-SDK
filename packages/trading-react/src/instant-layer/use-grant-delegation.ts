"use client";

import { grantDelegationMutationOptions, type GrantDelegationParameters } from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { invalidateDelegationGrant } from "./invalidate-delegation-grant";

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
 * Grant Instant Layer delegation access for one delegated signer.
 *
 * **The transport comes from config, not from the hook.** Where the chain runs
 * in gasless execution mode (or the call passes `gasless: true`), the grant is
 * signed as an InstantLayer operation and relayed — the owner pays no native
 * gas — and the relayer's broadcast hash comes back exactly where a
 * wallet-submitted hash would, so the receipt wait and the invalidation below
 * are identical either way. A `isPartyB: true` account always takes the wallet
 * path; the signed-operation encoder has no PartyB form.
 *
 * On success the delegation reads for the account/delegated signer are
 * invalidated (expiry, active status, the active-delegation probe and any
 * pending revocation the grant cleared), along with the reads a *relayed*
 * grant additionally moves.
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
      invalidateDelegationGrant(queryClient, {
        /** The chain the write went to: the action defaults an omitted `chainId` to the config's. */
        configKey: config.getChainConfigKey(variables.chainId ?? config.defaultChainId),
        account: variables.account.addr,
        delegates: [variables.delegatedSigner],
      });
    },
  });
}
