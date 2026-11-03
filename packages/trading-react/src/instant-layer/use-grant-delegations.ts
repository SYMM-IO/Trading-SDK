"use client";

import { grantDelegationsMutationOptions, type GrantDelegationsParameters } from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { invalidateDelegationGrant } from "./invalidate-delegation-grant";

/**
 * Parameters for {@link useGrantDelegations}.
 */
export type UseGrantDelegationsParameters = WriteParameters;

/**
 * Result returned by the {@link useGrantDelegations} mutation.
 */
export type GrantDelegationsResult = WriteResult;

/** Return type of {@link useGrantDelegations}. */
export type UseGrantDelegationsReturnType = UseMutationResult<
  GrantDelegationsResult,
  SymmioRequestError,
  GrantDelegationsParameters
>;

/**
 * Grant InstantLayer delegations to several signers of one account in a single
 * call, for example a session key and a TP/SL executor at once.
 *
 * **The transport comes from config, not from the hook.** Where the chain runs
 * in gasless execution mode (or the call passes `gasless: true`), the whole
 * grant is one owner signature, relayed with no native gas; otherwise it is one
 * wallet transaction. An empty list or a PartyB account is rejected before any
 * prompt, since the contract always reverts both. The InstantLayer must have
 * `grantDelegations`; older deployments revert.
 *
 * On success every granted delegate's reads for the account are invalidated
 * (expiry, active status, the active-delegation probe and any pending
 * revocation the grant cleared), along with the reads a *relayed* grant
 * additionally moves.
 *
 * @example
 * ```tsx
 * const { mutate } = useGrantDelegations();
 * mutate({
 *   account: { addr: subAccount, isPartyB: false },
 *   delegations: [
 *     { delegatedSigner: sessionKey, selectors: sessionKeySelectors, expiryTimestamp },
 *     { delegatedSigner: tpslExecutor, selectors: tradingSelectors, expiryTimestamp },
 *   ],
 * });
 * ```
 */
export function useGrantDelegations(parameters: UseGrantDelegationsParameters = {}): UseGrantDelegationsReturnType {
  const config = useSymmioConfig(parameters);
  const queryClient = useQueryClient();

  const base = grantDelegationsMutationOptions(config);

  return useMutation<GrantDelegationsResult, SymmioRequestError, GrantDelegationsParameters>({
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
        delegates: variables.delegations.map((delegation) => delegation.delegatedSigner),
      });
    },
  });
}
