"use client";

import {
  relayInstantOperationsMutationOptions,
  type RelayInstantOperationsParameters,
  type RelayInstantOperationsReturnType,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import type { GaslessRelayParameters, GaslessRelayProgress, GaslessRelayResult } from "./gasless-relay-types";
import { invalidateRelayInstantOperationsReads } from "./invalidate-relay-reads";
import { useGaslessRelayConfirmation } from "./use-gasless-relay-confirmation";

/** Parameters for {@link useRelayInstantOperations}. */
export type UseRelayInstantOperationsParameters = GaslessRelayParameters;

/** Mutation variables of {@link useRelayInstantOperations}: the core action's parameters. */
export type RelayInstantOperationsVariables = RelayInstantOperationsParameters;

/** What {@link useRelayInstantOperations} resolves with. */
export type RelayInstantOperationsResult = GaslessRelayResult<RelayInstantOperationsReturnType>;

/** Return type of {@link useRelayInstantOperations}. */
export type UseRelayInstantOperationsReturnType = UseMutationResult<
  RelayInstantOperationsResult,
  SymmioRequestError,
  RelayInstantOperationsVariables
> & {
  /** Live relay progress — `queued` → `submitted` → `confirmed`. */
  relay: GaslessRelayProgress;
};

/**
 * Submit pre-signed InstantLayer operations to the GaslessQ relayer - the
 * explicit escape hatch under the transparent gasless execution mode.
 *
 * **Resolves when the operation has landed, not when the relayer accepts it.**
 * A submit returns `202` in milliseconds while the transaction lands seconds
 * later, so resolving on acceptance would resolve before the effect exists. By
 * default this waits for the terminal `succeeded` and then for the receipt on
 * your own client, then invalidates the reads below.
 *
 * Set `confirmation: "none"` to resolve on acceptance instead; you then own the
 * polling and the invalidation. A non-succeeded terminal rejects with the
 * record attached to the error's `responseData`.
 *
 * Only transport-level reads are invalidated — the InstantLayer nonce, the
 * operational-fee allowance and account balances. `operationType` is a
 * free-form label the fee policy ignores, so the SDK cannot know which domain
 * reads a batch touched and must not guess: pass your own `onSuccess` to
 * `mutate`, which now runs after confirmation.
 *
 * @example
 * ```tsx
 * const relay = useRelayInstantOperations();
 * const receipt = await relay.mutateAsync({ userAddress, operationType, operations });
 * ```
 */
export function useRelayInstantOperations(
  parameters: UseRelayInstantOperationsParameters = {},
): UseRelayInstantOperationsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const confirmation = useGaslessRelayConfirmation(parameters, config);

  const options = relayInstantOperationsMutationOptions(config);

  const mutation = useMutation({
    ...options,
    mutationFn: async (variables: RelayInstantOperationsVariables): Promise<RelayInstantOperationsResult> => {
      const resolvedChainId = variables.chainId ?? chainId;
      try {
        const accepted = await options.mutationFn({ ...variables, chainId: resolvedChainId });
        const confirmed = await confirmation.confirm(accepted, {
          chainId: resolvedChainId,
          service: "operations",
          invalidate: (queryClient) =>
            invalidateRelayInstantOperationsReads(
              queryClient,
              { configKey: config.getChainConfigKey(resolvedChainId) },
              variables.operations.map((entry) => entry.operation.signerAccount.addr),
            ),
        });
        return { accepted, confirmed };
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseMutationResult<RelayInstantOperationsResult, SymmioRequestError, RelayInstantOperationsVariables>;

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
