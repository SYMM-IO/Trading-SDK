import type { Config } from "../../../core/config";
import { depositForAccount, type DepositForAccountParameters } from "../actions/deposit-for-account";

/**
 * Build TanStack Mutation options for {@link depositForAccount}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `depositForAccount(config, …)`. Framework layers compose `onSuccess`
 * invalidation (e.g. of collateral allowance/balance reads) and error
 * normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(depositForAccountMutationOptions(config));
 * ```
 */
export function depositForAccountMutationOptions(config: Config) {
  return {
    mutationKey: ["depositForAccount"] as const,
    mutationFn: (variables: DepositForAccountParameters) => depositForAccount(config, variables),
  };
}
