import type { Config } from "../../../core/config";
import {
  simulateDeallocateAndInitiateWithdraw,
  type SimulateDeallocateAndInitiateWithdrawParameters,
} from "../actions/simulate-deallocate-and-initiate-withdraw";

/**
 * Build TanStack Mutation options for {@link simulateDeallocateAndInitiateWithdraw}
 * — an on-demand dry-run (`simulateContract`) of the batched deallocate +
 * initiate-withdraw.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(simulateDeallocateAndInitiateWithdrawMutationOptions(config));
 * ```
 */
export function simulateDeallocateAndInitiateWithdrawMutationOptions(config: Config) {
  return {
    mutationKey: ["simulateDeallocateAndInitiateWithdraw"] as const,
    mutationFn: (variables: SimulateDeallocateAndInitiateWithdrawParameters) =>
      simulateDeallocateAndInitiateWithdraw(config, variables),
  };
}
