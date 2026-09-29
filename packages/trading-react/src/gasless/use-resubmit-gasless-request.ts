"use client";

import {
  resubmitGaslessRequestMutationOptions,
  type GaslessDepositSubmitReceipt,
  type ResubmitGaslessRequestParameters,
  type ResubmitGaslessRequestReturnType,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { isAddress, type Address } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioConfig } from "../provider/use-symmio-config";
import type { GaslessRelayParameters, GaslessRelayProgress, GaslessRelayResult } from "./gasless-relay-types";
import { invalidateDepositSettlementReads, invalidateRelayInstantOperationsReads } from "./invalidate-relay-reads";
import { useGaslessRelayConfirmation } from "./use-gasless-relay-confirmation";

/** Parameters for {@link useResubmitGaslessRequest}. */
export type UseResubmitGaslessRequestParameters = GaslessRelayParameters;

/** Mutation variables of {@link useResubmitGaslessRequest}: the recorded submit, unchanged. */
export type ResubmitGaslessRequestVariables = ResubmitGaslessRequestParameters;

/** What {@link useResubmitGaslessRequest} resolves with. */
export type ResubmitGaslessRequestResult = GaslessRelayResult<ResubmitGaslessRequestReturnType>;

/** Return type of {@link useResubmitGaslessRequest}. */
export type UseResubmitGaslessRequestReturnType = UseMutationResult<
  ResubmitGaslessRequestResult,
  SymmioRequestError,
  ResubmitGaslessRequestVariables
> & {
  /** Live relay progress — `queued` → `submitted` → `confirmed`. */
  relay: GaslessRelayProgress;
};

/**
 * The sub-accounts an operations batch consumed nonces under, read off the
 * recorded body.
 *
 * The receipt names the owner, not the signer accounts, and the recorded bytes
 * are the only place the batch's own `signerAccount` addresses survive. An
 * unreadable body widens to "every account on the chain" rather than
 * invalidating nothing — a superset is correct, a silent no-op is not.
 */
function toSignerAccounts(body: unknown): Address[] {
  const signedOps = (body as { signedOps?: unknown })?.signedOps;
  if (!Array.isArray(signedOps)) return [];
  return signedOps
    .map((operation) => (operation as { signerAccount?: { addr?: unknown } })?.signerAccount?.addr)
    .filter((address): address is Address => typeof address === "string" && isAddress(address));
}

/**
 * Replay a gasless submit whose outcome was never established, byte for byte,
 * under its original idempotency key.
 *
 * This is the recovery path for `GASLESS_SUBMIT_UNCONFIRMED`: take the record
 * out of the error with `getGaslessUnconfirmedSubmit`, persist it, and hand it
 * to this hook — resending the identical request either lands it or returns the
 * record the service already created, so it can never execute twice. Running
 * the intent again through the wallet would.
 *
 * Confirms like every other relay hook: it resolves when the request has
 * landed, not when the relayer accepts it, and then invalidates what the replay
 * changed — the batch's InstantLayer nonces and fee allowance for an operations
 * replay, the swept address and wallet reads for a settlement.
 *
 * @example
 * ```tsx
 * const resubmit = useResubmitGaslessRequest();
 * const pending = getGaslessUnconfirmedSubmit(error);
 * if (pending) await resubmit.mutateAsync(pending);
 * ```
 */
export function useResubmitGaslessRequest(
  parameters: UseResubmitGaslessRequestParameters = {},
): UseResubmitGaslessRequestReturnType {
  const config = useSymmioConfig(parameters);
  const confirmation = useGaslessRelayConfirmation(parameters, config);

  const options = resubmitGaslessRequestMutationOptions(config);

  const mutation = useMutation({
    ...options,
    mutationFn: async (variables: ResubmitGaslessRequestVariables): Promise<ResubmitGaslessRequestResult> => {
      /** The recorded submit names its own chain — a replay must never land on another one. */
      const { chainId, path, service } = variables;
      try {
        const accepted = await confirmation.submit(() => options.mutationFn(variables));
        const scope = { configKey: config.getChainConfigKey(chainId) };
        const confirmed = await confirmation.confirm(accepted, {
          chainId,
          service,
          invalidate: (queryClient) => {
            if (service === "operations") {
              invalidateRelayInstantOperationsReads(queryClient, scope, toSignerAccounts(variables.body));
              return;
            }
            const receipt = accepted as GaslessDepositSubmitReceipt;
            invalidateDepositSettlementReads(queryClient, scope, {
              depositAddress: receipt.depositAddress,
              owner: receipt.owner,
              walletId: receipt.walletId,
              /** A new-account settlement also created a sub-account, whatever attempt landed it. */
              newAccount: path === "/deposit-settlements/new-account",
            });
          },
        });
        return { accepted, confirmed };
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseMutationResult<ResubmitGaslessRequestResult, SymmioRequestError, ResubmitGaslessRequestVariables>;

  /**
   * Capture the observer's own `reset` before merging: `Object.assign` writes
   * onto `mutation` itself, so a wrapper that called `mutation.reset()` would
   * resolve to the wrapper and recurse until the stack blew.
   */
  const resetMutation = mutation.reset;

  return Object.assign(mutation, {
    relay: confirmation.progress,
    reset: () => {
      confirmation.reset();
      resetMutation();
    },
  });
}
