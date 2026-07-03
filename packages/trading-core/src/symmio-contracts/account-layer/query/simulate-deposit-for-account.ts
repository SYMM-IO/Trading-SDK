import type { Config } from "../../../core/config";
import {
  simulateDepositForAccount,
  type SimulateDepositForAccountParameters,
} from "../actions/simulate-deposit-for-account";

/**
 * Build TanStack Mutation options for {@link simulateDepositForAccount} — an on-demand dry-run
 * (`simulateContract`) of depositForAccount.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(simulateDepositForAccountMutationOptions(config));
 * ```
 */
export function simulateDepositForAccountMutationOptions(config: Config) {
  return {
    mutationKey: ["simulateDepositForAccount"] as const,
    mutationFn: (variables: SimulateDepositForAccountParameters) => simulateDepositForAccount(config, variables),
  };
}
