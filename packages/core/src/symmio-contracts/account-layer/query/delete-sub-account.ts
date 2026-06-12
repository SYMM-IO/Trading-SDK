import type { Config } from "../../../core/config";
import { deleteSubAccount, type DeleteSubAccountParameters } from "../actions/delete-sub-account";

/**
 * Build TanStack Mutation options for {@link deleteSubAccount}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `deleteSubAccount(config, …)`. Framework layers compose `onSuccess`
 * invalidation (e.g. of `getUserSubAccounts`) and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(deleteSubAccountMutationOptions(config));
 * ```
 */
export function deleteSubAccountMutationOptions(config: Config) {
  return {
    mutationKey: ["deleteSubAccount"] as const,
    mutationFn: (variables: DeleteSubAccountParameters) => deleteSubAccount(config, variables),
  };
}
