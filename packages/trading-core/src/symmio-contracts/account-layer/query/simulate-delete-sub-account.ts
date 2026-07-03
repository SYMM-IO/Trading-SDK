import type { Config } from "../../../core/config";
import {
  simulateDeleteSubAccount,
  type SimulateDeleteSubAccountParameters,
} from "../actions/simulate-delete-sub-account";

/**
 * Build TanStack Mutation options for {@link simulateDeleteSubAccount} — an on-demand dry-run
 * (`simulateContract`) of deleteSubAccount.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(simulateDeleteSubAccountMutationOptions(config));
 * ```
 */
export function simulateDeleteSubAccountMutationOptions(config: Config) {
  return {
    mutationKey: ["simulateDeleteSubAccount"] as const,
    mutationFn: (variables: SimulateDeleteSubAccountParameters) => simulateDeleteSubAccount(config, variables),
  };
}
