import type { Config } from "../../../core/config";
import {
  depositAndAllocateForAccount,
  type DepositAndAllocateForAccountParameters,
} from "../actions/deposit-and-allocate-for-account";

/**
 * Build TanStack Mutation options for {@link depositAndAllocateForAccount}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `depositAndAllocateForAccount(config, …)`. Framework layers compose `onSuccess`
 * invalidation (e.g. of collateral allowance/balance reads) and error
 * normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(depositAndAllocateForAccountMutationOptions(config));
 * ```
 */
export function depositAndAllocateForAccountMutationOptions(config: Config) {
  return {
    mutationKey: ["depositAndAllocateForAccount"] as const,
    mutationFn: (variables: DepositAndAllocateForAccountParameters) => depositAndAllocateForAccount(config, variables),
  };
}
