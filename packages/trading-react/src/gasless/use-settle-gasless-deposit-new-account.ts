"use client";

import {
  settleGaslessDepositNewAccountMutationOptions,
  type SettleGaslessDepositNewAccountParameters,
  type SettleGaslessDepositNewAccountReturnType,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import type { GaslessRelayParameters, GaslessRelayProgress, GaslessRelayResult } from "./gasless-relay-types";
import { invalidateDepositSettlementReads } from "./invalidate-relay-reads";
import { useGaslessRelayConfirmation } from "./use-gasless-relay-confirmation";

/** Parameters for {@link useSettleGaslessDepositNewAccount}. */
export type UseSettleGaslessDepositNewAccountParameters = GaslessRelayParameters;

/** Mutation variables of {@link useSettleGaslessDepositNewAccount}: the core action's parameters. */
export type SettleGaslessDepositNewAccountVariables = SettleGaslessDepositNewAccountParameters;

/** What {@link useSettleGaslessDepositNewAccount} resolves with. */
export type SettleGaslessDepositNewAccountResult = GaslessRelayResult<SettleGaslessDepositNewAccountReturnType>;

/** Return type of {@link useSettleGaslessDepositNewAccount}. */
export type UseSettleGaslessDepositNewAccountReturnType = UseMutationResult<
  SettleGaslessDepositNewAccountResult,
  SymmioRequestError,
  SettleGaslessDepositNewAccountVariables
> & {
  /** Live relay progress — `queued` → `submitted` → `confirmed`. */
  relay: GaslessRelayProgress;
};

/**
 * Queue the sweep of an owner's deposit address into a new wallet-owned
 * sub-account. Poll the receipt's `requestId` with `service: "deposits"`;
 * `succeeded` still needs an on-chain readiness wait before the account is usable.
 *
 * **Resolves when the settlement has landed, not when the relayer accepts it.**
 * A submit returns `202` in milliseconds while the transaction lands seconds
 * later, so resolving on acceptance would resolve before the effect exists. By
 * default this waits for the terminal `succeeded` and then for the receipt on
 * your own client, then invalidates the reads below.
 *
 * Set `confirmation: "none"` to resolve on acceptance instead; you then own the
 * polling and the invalidation. A non-succeeded terminal rejects with the
 * record attached to the error's `responseData`.
 *
 * The default `confirmation: "receipt"` is what removes this flow's old caveat
 * that a `succeeded` settlement is not instantly readable: the receipt is
 * awaited on the same client the invalidated reads use, so the new sub-account
 * and its balance are readable when they refetch. Lowering it to `"terminal"`
 * brings the caveat back.
 *
 * @example
 * ```tsx
 * const relay = useSettleGaslessDepositNewAccount();
 * const receipt = await relay.mutateAsync({ wallet, affiliate, accountData });
 * ```
 */
export function useSettleGaslessDepositNewAccount(
  parameters: UseSettleGaslessDepositNewAccountParameters = {},
): UseSettleGaslessDepositNewAccountReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const confirmation = useGaslessRelayConfirmation(parameters, config);

  const options = settleGaslessDepositNewAccountMutationOptions(config);

  const mutation = useMutation({
    ...options,
    mutationFn: async (
      variables: SettleGaslessDepositNewAccountVariables,
    ): Promise<SettleGaslessDepositNewAccountResult> => {
      const resolvedChainId = variables.chainId ?? chainId;
      try {
        const accepted = await options.mutationFn({ ...variables, chainId: resolvedChainId });
        const confirmed = await confirmation.confirm(accepted, {
          chainId: resolvedChainId,
          service: "deposits",
          invalidate: (queryClient) =>
            invalidateDepositSettlementReads(
              queryClient,
              { configKey: config.getChainConfigKey(resolvedChainId) },
              { depositAddress: accepted.depositAddress, wallet: variables.wallet },
            ),
        });
        return { accepted, confirmed };
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseMutationResult<
    SettleGaslessDepositNewAccountResult,
    SymmioRequestError,
    SettleGaslessDepositNewAccountVariables
  >;

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
