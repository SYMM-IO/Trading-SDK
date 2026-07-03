import type { Config } from "../../../core/config";
import { simulateEditAccountName, type SimulateEditAccountNameParameters } from "../actions/simulate-edit-account-name";

/**
 * Build TanStack Mutation options for {@link simulateEditAccountName} — an on-demand dry-run
 * (`simulateContract`) of editAccountName.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(simulateEditAccountNameMutationOptions(config));
 * ```
 */
export function simulateEditAccountNameMutationOptions(config: Config) {
  return {
    mutationKey: ["simulateEditAccountName"] as const,
    mutationFn: (variables: SimulateEditAccountNameParameters) => simulateEditAccountName(config, variables),
  };
}
