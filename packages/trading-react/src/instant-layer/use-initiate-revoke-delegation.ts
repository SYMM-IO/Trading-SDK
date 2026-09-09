"use client";

import {
  getActiveDelegationsQueryKey,
  getDelegationExpiryQueryKey,
  getIsDelegationActiveQueryKey,
  initiateRevokeDelegationMutationOptions,
  type InitiateRevokeDelegationParameters,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { resolveWriteResult, type WriteParameters, type WriteResult } from "../transactions";
import { predicateMatch } from "../utils";

/** Parameters for {@link useInitiateRevokeDelegation}. */
export type UseInitiateRevokeDelegationParameters = WriteParameters;

/** Result returned by the {@link useInitiateRevokeDelegation} mutation. */
export type InitiateRevokeDelegationResult = WriteResult;

/** Return type of {@link useInitiateRevokeDelegation}. */
export type UseInitiateRevokeDelegationReturnType = UseMutationResult<
  InitiateRevokeDelegationResult,
  SymmioRequestError,
  InitiateRevokeDelegationParameters
>;

/**
 * Start revoking a session key's Instant Layer delegation.
 *
 * **Always a gas-paid wallet transaction — there is no gasless option.** The
 * relay signs InstantLayer *operations*, and the contract accepts a
 * self-targeted operation only as a delegation grant, so a relayed revocation
 * would revert. Budget native gas for this call.
 *
 * The contract accepts it from the account owner, from the delegate itself, or
 * from a `REVOKER_ROLE` holder, and it only *schedules* the revocation: the key
 * keeps its authority until the cooldown ETA passes (see
 * {@link useRevocationCooldown}), after which {@link useFinalizeRevokeDelegation}
 * clears the stored grant.
 *
 * @example
 * ```tsx
 * const { mutate } = useInitiateRevokeDelegation();
 * mutate({ account: { addr: subAccount, isPartyB: false }, delegate: sessionKey, selectors });
 * ```
 */
export function useInitiateRevokeDelegation(
  parameters: UseInitiateRevokeDelegationParameters = {},
): UseInitiateRevokeDelegationReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();

  const base = initiateRevokeDelegationMutationOptions(config);

  return useMutation<InitiateRevokeDelegationResult, SymmioRequestError, InitiateRevokeDelegationParameters>({
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
    },
  });
}
