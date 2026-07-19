import type { Config } from "../../../core/config";
import {
  simulateRequestToRegisterAffiliate,
  type SimulateRequestToRegisterAffiliateParameters,
} from "../actions/simulate-request-to-register-affiliate";

/**
 * Build TanStack Mutation options for {@link simulateRequestToRegisterAffiliate} —
 * an on-demand dry-run (`simulateContract`) of requestToRegisterAffiliate.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(simulateRequestToRegisterAffiliateMutationOptions(config));
 * ```
 */
export function simulateRequestToRegisterAffiliateMutationOptions(config: Config) {
  return {
    mutationKey: ["simulateRequestToRegisterAffiliate"] as const,
    mutationFn: (variables: SimulateRequestToRegisterAffiliateParameters) =>
      simulateRequestToRegisterAffiliate(config, variables),
  };
}
