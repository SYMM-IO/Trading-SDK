"use client";

import {
  finalizeRevokeDelegationMutationOptions,
  getActiveDelegationsQueryKey,
  getDelegationExpiryQueryKey,
  getIsDelegationActiveQueryKey,
  getPendingRevocationEtasQueryKey,
  type FinalizeRevokeDelegationParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/** Parameters for {@link useFinalizeRevokeDelegation}. */
export type UseFinalizeRevokeDelegationParameters = WriteParameters;

/** Result returned by the {@link useFinalizeRevokeDelegation} mutation. */
export type FinalizeRevokeDelegationResult = WriteResult;

/** Return type of {@link useFinalizeRevokeDelegation}. */
export type UseFinalizeRevokeDelegationReturnType = UseMutationResult<
  FinalizeRevokeDelegationResult,
  SymmioRequestError,
  FinalizeRevokeDelegationParameters
>;

/**
 * Complete a scheduled Instant Layer revocation, clearing the stored grant.
 *
 * **Always a gas-paid wallet transaction — there is no gasless option.** The
 * relay signs InstantLayer *operations*, and the contract accepts a
 * self-targeted operation only as a delegation grant, so a relayed revocation
 * would revert.
 *
 * **Permissionless once the cooldown has passed**, so a keeper or backend can
 * finish a revocation the owner started. It reverts `RevocationCooldownNotOver`
 * while the ETA is still in the future. Note that enforcement already stops
 * honoring the delegation at the ETA, so this is the bookkeeping leg rather
 * than the moment authority ends — see {@link useInitiateRevokeDelegation}.
 *
 * @example
 * ```tsx
 * const { mutate } = useFinalizeRevokeDelegation();
 * mutate({ account: { addr: subAccount, isPartyB: false }, delegate: sessionKey, selectors });
 * ```
 */
export function useFinalizeRevokeDelegation(
  parameters: UseFinalizeRevokeDelegationParameters = {},
): UseFinalizeRevokeDelegationReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();

  const base = finalizeRevokeDelegationMutationOptions(config);

  return useMutation<FinalizeRevokeDelegationResult, SymmioRequestError, FinalizeRevokeDelegationParameters>({
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
      const delegation = { configKey, account: variables.account.addr, delegate: variables.delegate };

      void queryClient.invalidateQueries({ predicate: predicateMatch(getDelegationExpiryQueryKey, delegation) });
      void queryClient.invalidateQueries({ predicate: predicateMatch(getIsDelegationActiveQueryKey, delegation) });
      /**
       * The canonicalizing read keys by `delegator`, not `account`, so it needs
       * its own predicate rather than reusing the pair above.
       */
      void queryClient.invalidateQueries({
        predicate: predicateMatch(getActiveDelegationsQueryKey, { configKey, delegator: variables.account }),
      });
      /** Finalizing clears the schedule too, so the pending read must not go stale. */
      void queryClient.invalidateQueries({
        predicate: predicateMatch(getPendingRevocationEtasQueryKey, {
          configKey,
          delegator: variables.account,
          delegate: variables.delegate,
        }),
      });
    },
  });
}
