import type { Config } from "../../../core/config";
import {
  simulateGrantDelegations,
  type SimulateGrantDelegationsParameters,
} from "../actions/simulate-grant-delegations";

/**
 * Build TanStack Mutation options for {@link simulateGrantDelegations} — an
 * on-demand dry-run (`simulateContract`) of grantDelegations.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(simulateGrantDelegationsMutationOptions(config));
 * ```
 */
export function simulateGrantDelegationsMutationOptions(config: Config) {
  return {
    mutationKey: ["simulateGrantDelegations"] as const,
    mutationFn: (variables: SimulateGrantDelegationsParameters) => simulateGrantDelegations(config, variables),
  };
}
