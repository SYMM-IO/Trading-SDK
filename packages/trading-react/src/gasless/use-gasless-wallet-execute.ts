"use client";

import {
  gaslessWalletExecuteMutationOptions,
  type GaslessWalletExecuteParameters,
  type GaslessWalletExecuteReturnType,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import type { GaslessRelayParameters, GaslessRelayProgress, GaslessRelayResult } from "./gasless-relay-types";
import { invalidateGaslessWalletExecuteReads } from "./invalidate-relay-reads";
import { useGaslessRelayConfirmation } from "./use-gasless-relay-confirmation";

/** Parameters for {@link useGaslessWalletExecute}. */
export type UseGaslessWalletExecuteParameters = GaslessRelayParameters;

/** Mutation variables of {@link useGaslessWalletExecute}: the core action's parameters. */
export type GaslessWalletExecuteVariables = GaslessWalletExecuteParameters;

/** What {@link useGaslessWalletExecute} resolves with. */
export type GaslessWalletExecuteResult = GaslessRelayResult<GaslessWalletExecuteReturnType>;

/** Return type of {@link useGaslessWalletExecute}. */
export type UseGaslessWalletExecuteReturnType = UseMutationResult<
  GaslessWalletExecuteResult,
  SymmioRequestError,
  GaslessWalletExecuteVariables
> & {
  /** Live relay progress — `queued` → `submitted` → `confirmed`. */
  relay: GaslessRelayProgress;
};

/**
 * Run **any contract call from the deterministic gasless wallet**, with no
 * native gas — an atomic batch of arbitrary calls, each given either as raw
 * `data` or as an `{ abi, functionName, args }` triple the SDK encodes.
 *
 * The wallet's own balance never pays the fee: the GaslessLayer prices the
 * operation from the inner call selectors and charges the SYMMIO account,
 * bounded by its operational-fee allowance. See `gaslessWalletExecute`.
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
 * On success the wallet's nonce, its collateral balance and the fee allowance
 * are invalidated.
 *
 * @example
 * ```tsx
 * const relay = useGaslessWalletExecute();
 * const receipt = await relay.mutateAsync({
 *   calls: [
 *     { target: usdc, abi: erc20Abi, functionName: "approve", args: [router, amount] },
 *     { target: router, data: routeCalldata },
 *   ],
 * });
 * ```
 */
export function useGaslessWalletExecute(
  parameters: UseGaslessWalletExecuteParameters = {},
): UseGaslessWalletExecuteReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const confirmation = useGaslessRelayConfirmation(parameters, config);

  const options = gaslessWalletExecuteMutationOptions(config);

  const mutation = useMutation({
    ...options,
    mutationFn: async (variables: GaslessWalletExecuteVariables): Promise<GaslessWalletExecuteResult> => {
      const resolvedChainId = variables.chainId ?? chainId;
      try {
        const accepted = await options.mutationFn({ ...variables, chainId: resolvedChainId });
        const confirmed = await confirmation.confirm(accepted, {
          chainId: resolvedChainId,
          service: "operations",
          invalidate: (queryClient) =>
            invalidateGaslessWalletExecuteReads(
              queryClient,
              { configKey: config.getChainConfigKey(resolvedChainId) },
              variables.owner,
            ),
        });
        return { accepted, confirmed };
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseMutationResult<GaslessWalletExecuteResult, SymmioRequestError, GaslessWalletExecuteVariables>;

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
