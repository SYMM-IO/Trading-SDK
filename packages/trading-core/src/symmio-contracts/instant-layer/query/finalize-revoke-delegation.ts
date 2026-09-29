import type { Config } from "../../../core/config";
import {
  finalizeRevokeDelegation,
  type FinalizeRevokeDelegationParameters,
} from "../actions/finalize-revoke-delegation";

/**
 * Build TanStack Mutation options for {@link finalizeRevokeDelegation}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `finalizeRevokeDelegation(config, …)`. Framework layers compose invalidation
 * and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(finalizeRevokeDelegationMutationOptions(config));
 * ```
 */
export function finalizeRevokeDelegationMutationOptions(config: Config) {
  return {
    mutationKey: ["finalizeRevokeDelegation"] as const,
    mutationFn: (variables: FinalizeRevokeDelegationParameters) => finalizeRevokeDelegation(config, variables),
  };
}
