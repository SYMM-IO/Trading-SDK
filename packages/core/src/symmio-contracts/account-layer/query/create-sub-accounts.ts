import type { Config } from "../../../core/config";
import { createSubAccounts, type CreateSubAccountsParameters } from "../actions/create-sub-accounts";

/**
 * Build TanStack Mutation options for {@link createSubAccounts}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `createSubAccounts(config, …)`. Framework layers compose `onSuccess`
 * invalidation (e.g. of `getUserSubAccounts`) and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(createSubAccountsMutationOptions(config));
 * ```
 */
export function createSubAccountsMutationOptions(config: Config) {
  return {
    mutationKey: ["createSubAccounts"] as const,
    mutationFn: (variables: CreateSubAccountsParameters) => createSubAccounts(config, variables),
  };
}
