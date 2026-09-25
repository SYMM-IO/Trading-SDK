"use client";

import {
  relayGaslessBatchMutationOptions,
  type RelayGaslessBatchParameters,
  type RelayGaslessBatchReturnType,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import type { GaslessRelayParameters, GaslessRelayProgress, GaslessRelayResult } from "./gasless-relay-types";
import { invalidateGaslessBatchReads } from "./invalidate-relay-reads";
import { useGaslessRelayConfirmation } from "./use-gasless-relay-confirmation";

/** Parameters for {@link useRelayGaslessBatch}. */
export type UseRelayGaslessBatchParameters = GaslessRelayParameters;

/** Mutation variables of {@link useRelayGaslessBatch}: the core action's parameters. */
export type RelayGaslessBatchVariables = RelayGaslessBatchParameters;

/** What {@link useRelayGaslessBatch} resolves with. */
export type RelayGaslessBatchResult = GaslessRelayResult<RelayGaslessBatchReturnType>;

/** Return type of {@link useRelayGaslessBatch}. */
export type UseRelayGaslessBatchReturnType = UseMutationResult<
  RelayGaslessBatchResult,
  SymmioRequestError,
  RelayGaslessBatchVariables
> & {
  /** Live relay progress — `queued` → `submitted` → `confirmed`. */
  relay: GaslessRelayProgress;
};

/**
 * Relay **several gasless actions as one request** — one atomic transaction,
 * no native gas. Give relayable writes as `{ functionName, args }` (optional
 * `abi`) or raw `{ data }`, and GaslessWallet calls as `{ walletCalls, walletId }`;
 * see `relayGaslessBatch`.
 *
 * Every call is signed separately — the protocol has no batch signature — so
 * a browser wallet shows one prompt per call, in order, while a session key
 * (`from`) signs them silently. Nothing is submitted until every prompt is
 * signed. Preview the same batch with {@link useGaslessBatchFeeQuote}.
 *
 * **Resolves when the batch has landed, not when the relayer accepts it.** By
 * default this waits for the terminal `succeeded` and then for the receipt on
 * your own client, then invalidates what the batch's calls changed — the
 * account's nonce, balances and fee allowance always, plus the withdrawal,
 * quote, sub-account, deposit, delegation and GaslessWallet reads of the calls
 * it actually carried. Set `confirmation: "none"` to resolve on acceptance and
 * own the polling and invalidation yourself.
 *
 * @example
 * ```tsx
 * const batch = useRelayGaslessBatch();
 * await batch.mutateAsync({
 *   account: subAccount,
 *   calls: [
 *     { functionName: "approveOperationalFeeWithMultiplier", args: [[gaslessLayer], [budget18], [10_000n]] },
 *     { functionName: "allocate", args: [amount] },
 *   ],
 * });
 * ```
 */
export function useRelayGaslessBatch(parameters: UseRelayGaslessBatchParameters = {}): UseRelayGaslessBatchReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const confirmation = useGaslessRelayConfirmation(parameters, config);

  const options = relayGaslessBatchMutationOptions(config);

  const mutation = useMutation({
    ...options,
    mutationFn: async (variables: RelayGaslessBatchVariables): Promise<RelayGaslessBatchResult> => {
      const resolvedChainId = variables.chainId ?? chainId;
      try {
        const accepted = await confirmation.submit(() =>
          options.mutationFn({ ...variables, chainId: resolvedChainId }),
        );
        const confirmed = await confirmation.confirm(accepted, {
          chainId: resolvedChainId,
          service: "operations",
          operationType: variables.operationType,
          invalidate: (queryClient) =>
            invalidateGaslessBatchReads(
              queryClient,
              { configKey: config.getChainConfigKey(resolvedChainId) },
              variables,
            ),
        });
        return { accepted, confirmed };
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseMutationResult<RelayGaslessBatchResult, SymmioRequestError, RelayGaslessBatchVariables>;

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
