import type { Config } from "../../../core/config";
import {
  simulateCancelRegistration,
  type SimulateCancelRegistrationParameters,
} from "../actions/simulate-cancel-registration";

/**
 * Build TanStack Mutation options for {@link simulateCancelRegistration} — an
 * on-demand dry-run (`simulateContract`) of cancelRegistration.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(simulateCancelRegistrationMutationOptions(config));
 * ```
 */
export function simulateCancelRegistrationMutationOptions(config: Config) {
  return {
    mutationKey: ["simulateCancelRegistration"] as const,
    mutationFn: (variables: SimulateCancelRegistrationParameters) => simulateCancelRegistration(config, variables),
  };
}
