import type { Config } from "../../../core/config";
import {
  simulateCreateSubAccounts,
  type SimulateCreateSubAccountsParameters,
} from "../actions/simulate-create-sub-accounts";

/**
 * Build TanStack Mutation options for {@link simulateCreateSubAccounts} — an on-demand dry-run
 * (`simulateContract`) of createSubAccounts.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(simulateCreateSubAccountsMutationOptions(config));
 * ```
 */
export function simulateCreateSubAccountsMutationOptions(config: Config) {
  return {
    mutationKey: ["simulateCreateSubAccounts"] as const,
    mutationFn: (variables: SimulateCreateSubAccountsParameters) => simulateCreateSubAccounts(config, variables),
  };
}
