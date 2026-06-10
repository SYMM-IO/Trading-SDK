import type { Config } from "../../../core/config";
import { simulateAllocate, type SimulateAllocateParameters } from "../actions/simulate-allocate";

/**
 * Build TanStack Mutation options for {@link simulateAllocate} — an on-demand
 * dry-run (`simulateContract`) of allocate.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(simulateAllocateMutationOptions(config));
 * ```
 */
export function simulateAllocateMutationOptions(config: Config) {
  return {
    mutationKey: ["simulateAllocate"] as const,
    mutationFn: (variables: SimulateAllocateParameters) => simulateAllocate(config, variables),
  };
}
