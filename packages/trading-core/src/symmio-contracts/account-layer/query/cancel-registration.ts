import type { Config } from "../../../core/config";
import { cancelRegistration, type CancelRegistrationParameters } from "../actions/cancel-registration";

/**
 * Build TanStack Mutation options for {@link cancelRegistration}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `cancelRegistration(config, …)`. Framework layers compose `onSuccess`
 * invalidation (e.g. of `getAffiliateState`) and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(cancelRegistrationMutationOptions(config));
 * ```
 */
export function cancelRegistrationMutationOptions(config: Config) {
  return {
    mutationKey: ["cancelRegistration"] as const,
    mutationFn: (variables: CancelRegistrationParameters) => cancelRegistration(config, variables),
  };
}
