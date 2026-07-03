import type { Config } from "../../../core/config";
import { simulateGrantDelegation, type SimulateGrantDelegationParameters } from "../actions/simulate-grant-delegation";

/**
 * Build TanStack Mutation options for {@link simulateGrantDelegation} — an on-demand dry-run
 * (`simulateContract`) of grantDelegation.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(simulateGrantDelegationMutationOptions(config));
 * ```
 */
export function simulateGrantDelegationMutationOptions(config: Config) {
  return {
    mutationKey: ["simulateGrantDelegation"] as const,
    mutationFn: (variables: SimulateGrantDelegationParameters) => simulateGrantDelegation(config, variables),
  };
}
