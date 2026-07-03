import type { Config } from "../../../core/config";
import {
  simulateDepositAndAllocateForAccount,
  type SimulateDepositAndAllocateForAccountParameters,
} from "../actions/simulate-deposit-and-allocate-for-account";

/**
 * Build TanStack Mutation options for {@link simulateDepositAndAllocateForAccount} — an on-demand dry-run
 * (`simulateContract`) of depositAndAllocateForAccount.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(simulateDepositAndAllocateForAccountMutationOptions(config));
 * ```
 */
export function simulateDepositAndAllocateForAccountMutationOptions(config: Config) {
  return {
    mutationKey: ["simulateDepositAndAllocateForAccount"] as const,
    mutationFn: (variables: SimulateDepositAndAllocateForAccountParameters) =>
      simulateDepositAndAllocateForAccount(config, variables),
  };
}
