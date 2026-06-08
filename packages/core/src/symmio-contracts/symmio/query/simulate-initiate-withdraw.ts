import type { Config } from "../../../core/config";
import {
  simulateInitiateWithdraw,
  type SimulateInitiateWithdrawParameters,
} from "../actions/simulate-initiate-withdraw";

/**
 * Build TanStack Mutation options for {@link simulateInitiateWithdraw} — an on-demand
 * dry-run (`simulateContract`) of initiateWithdraw.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(simulateInitiateWithdrawMutationOptions(config));
 * ```
 */
export function simulateInitiateWithdrawMutationOptions(config: Config) {
  return {
    mutationKey: ["simulateInitiateWithdraw"] as const,
    mutationFn: (variables: SimulateInitiateWithdrawParameters) => simulateInitiateWithdraw(config, variables),
  };
}
