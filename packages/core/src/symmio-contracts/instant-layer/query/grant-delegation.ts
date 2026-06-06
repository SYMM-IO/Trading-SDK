import type { Config } from "../../../core/config";
import { grantDelegation, type GrantDelegationParameters } from "../actions/grant-delegation";

/**
 * Build TanStack Mutation options for {@link grantDelegation}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `grantDelegation(config, …)`. Framework layers compose invalidation and error
 * normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(grantDelegationMutationOptions(config));
 * ```
 */
export function grantDelegationMutationOptions(config: Config) {
  return {
    mutationKey: ["grantDelegation"] as const,
    mutationFn: (variables: GrantDelegationParameters) => grantDelegation(config, variables),
  };
}
