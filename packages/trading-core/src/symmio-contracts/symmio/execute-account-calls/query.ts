import type { Config } from "../../../core/config";
import { executeAccountCalls, type ExecuteAccountCallsParameters } from "./execute-account-calls";

/**
 * Build TanStack Mutation options for {@link executeAccountCalls}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards every
 * execution parameter to `executeAccountCalls(config, …)`. Framework layers
 * compose `onSuccess` invalidation (refresh the reads the calls affect after the
 * receipt confirms) and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(executeAccountCallsMutationOptions(config));
 * ```
 */
export function executeAccountCallsMutationOptions(config: Config) {
  return {
    mutationKey: ["executeAccountCalls"] as const,
    mutationFn: (variables: ExecuteAccountCallsParameters) => executeAccountCalls(config, variables),
  };
}
