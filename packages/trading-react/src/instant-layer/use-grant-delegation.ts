"use client";

import {
  getDelegationExpiryQueryKey,
  getInstantLayerNonceQueryKey,
  getIsDelegationActiveQueryKey,
  getOperationalFeeAllowanceQueryKey,
  grantDelegationMutationOptions,
  type GrantDelegationParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { invalidateAccountBalances, predicateMatch } from "../utils";

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
 * invalidated, along with the reads a *relayed* grant additionally moves.
 *
 * @example
 * ```tsx
 * const { mutate } = useGrantDelegation();
 * mutate({ account: { addr: account, isPartyB: false }, delegatedSigner, selectors, expiryTimestamp });
 * ```
 */
export function useGrantDelegation(parameters: UseGrantDelegationParameters = {}): UseGrantDelegationReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
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
      const configKey = config.getChainConfigKey(variables.chainId ?? chainId);
      const delegation = { configKey, account: variables.account.addr, delegate: variables.delegatedSigner };

      void queryClient.invalidateQueries({ predicate: predicateMatch(getDelegationExpiryQueryKey, delegation) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getIsDelegationActiveQueryKey, delegation) });

      /**
       * A relayed grant also consumes an InstantLayer nonce and charges the
       * operational fee from collateral. The hook cannot see which transport
       * ran, so it invalidates the superset: a wallet grant moves none of
       * these, and an extra refetch costs far less than a stale allowance
       * silently blocking the next relay.
       */
      void queryClient.invalidateQueries({
        predicate: predicateMatch(getInstantLayerNonceQueryKey, { configKey, account: variables.account.addr }),
      });
      void queryClient.invalidateQueries({
        predicate: predicateMatch(getOperationalFeeAllowanceQueryKey, { configKey, payer: variables.account.addr }),
      });
      invalidateAccountBalances(queryClient, { configKey });
    },
  });
}
