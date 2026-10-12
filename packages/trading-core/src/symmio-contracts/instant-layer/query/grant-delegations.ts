import type { Config } from "../../../core/config";
import { grantDelegations, type GrantDelegationsParameters } from "../actions/grant-delegations";

/**
 * Build TanStack Mutation options for {@link grantDelegations}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `grantDelegations(config, …)`. Framework layers compose invalidation and
 * error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(grantDelegationsMutationOptions(config));
 * ```
 */
export function grantDelegationsMutationOptions(config: Config) {
  return {
    mutationKey: ["grantDelegations"] as const,
    mutationFn: (variables: GrantDelegationsParameters) => grantDelegations(config, variables),
  };
}
