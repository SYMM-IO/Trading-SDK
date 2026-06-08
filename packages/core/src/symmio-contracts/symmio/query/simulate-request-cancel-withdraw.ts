import type { Config } from "../../../core/config";
import {
  simulateRequestCancelWithdraw,
  type SimulateRequestCancelWithdrawParameters,
} from "../actions/simulate-request-cancel-withdraw";

/**
 * Build TanStack Mutation options for {@link simulateRequestCancelWithdraw} — an on-demand
 * dry-run (`simulateContract`) of requestCancelWithdraw.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(simulateRequestCancelWithdrawMutationOptions(config));
 * ```
 */
export function simulateRequestCancelWithdrawMutationOptions(config: Config) {
  return {
    mutationKey: ["simulateRequestCancelWithdraw"] as const,
    mutationFn: (variables: SimulateRequestCancelWithdrawParameters) =>
      simulateRequestCancelWithdraw(config, variables),
  };
}
