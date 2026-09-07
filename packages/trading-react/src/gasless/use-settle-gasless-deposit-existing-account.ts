"use client";

import {
  settleGaslessDepositExistingAccountMutationOptions,
  type SettleGaslessDepositExistingAccountParameters,
  type SettleGaslessDepositExistingAccountReturnType,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import type { GaslessRelayParameters, GaslessRelayProgress, GaslessRelayResult } from "./gasless-relay-types";
import { invalidateDepositSettlementReads } from "./invalidate-relay-reads";
import { useGaslessRelayConfirmation } from "./use-gasless-relay-confirmation";

/** Parameters for {@link useSettleGaslessDepositExistingAccount}. */
export type UseSettleGaslessDepositExistingAccountParameters = GaslessRelayParameters;

/** Mutation variables of {@link useSettleGaslessDepositExistingAccount}: the core action's parameters. */
export type SettleGaslessDepositExistingAccountVariables = SettleGaslessDepositExistingAccountParameters;

/** What {@link useSettleGaslessDepositExistingAccount} resolves with. */
export type SettleGaslessDepositExistingAccountResult =
  GaslessRelayResult<SettleGaslessDepositExistingAccountReturnType>;

/** Return type of {@link useSettleGaslessDepositExistingAccount}. */
export type UseSettleGaslessDepositExistingAccountReturnType = UseMutationResult<
  SettleGaslessDepositExistingAccountResult,
  SymmioRequestError,
  SettleGaslessDepositExistingAccountVariables
> & {
  /** Live relay progress — `queued` → `submitted` → `confirmed`. */
  relay: GaslessRelayProgress;
};

/**
 * Queue the sweep of an owner's deposit address into an existing wallet-owned
 * sub-account (a gasless top-up). Poll with `service: "deposits"`.
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
 * On success the swept deposit address's collateral balance and the credited
 * sub-account's balances are invalidated.
 *
 * @example
 * ```tsx
 * const relay = useSettleGaslessDepositExistingAccount();
 * const receipt = await relay.mutateAsync({ wallet, subAccount });
 * ```
 */
export function useSettleGaslessDepositExistingAccount(
  parameters: UseSettleGaslessDepositExistingAccountParameters = {},
): UseSettleGaslessDepositExistingAccountReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const confirmation = useGaslessRelayConfirmation(parameters, config);

  const options = settleGaslessDepositExistingAccountMutationOptions(config);

  const mutation = useMutation({
    ...options,
    mutationFn: async (
      variables: SettleGaslessDepositExistingAccountVariables,
    ): Promise<SettleGaslessDepositExistingAccountResult> => {
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
              { depositAddress: accepted.depositAddress },
            ),
        });
        return { accepted, confirmed };
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseMutationResult<
    SettleGaslessDepositExistingAccountResult,
    SymmioRequestError,
    SettleGaslessDepositExistingAccountVariables
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
