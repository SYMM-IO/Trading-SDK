import type { Config } from "../../../core/config";
import { editAccountName, type EditAccountNameParameters } from "../actions/edit-account-name";

/**
 * Build TanStack Mutation options for {@link editAccountName}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `editAccountName(config, …)`. Framework layers compose `onSuccess`
 * invalidation and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(editAccountNameMutationOptions(config));
 * ```
 */
export function editAccountNameMutationOptions(config: Config) {
  return {
    mutationKey: ["editAccountName"] as const,
    mutationFn: (variables: EditAccountNameParameters) => editAccountName(config, variables),
  };
}
