import type { Config } from "../../../core/config";
import {
  initiateRevokeDelegation,
  type InitiateRevokeDelegationParameters,
} from "../actions/initiate-revoke-delegation";

/**
 * Build TanStack Mutation options for {@link initiateRevokeDelegation}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `initiateRevokeDelegation(config, …)`. Framework layers compose invalidation
 * and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(initiateRevokeDelegationMutationOptions(config));
 * ```
 */
export function initiateRevokeDelegationMutationOptions(config: Config) {
  return {
    mutationKey: ["initiateRevokeDelegation"] as const,
    mutationFn: (variables: InitiateRevokeDelegationParameters) => initiateRevokeDelegation(config, variables),
  };
}
