import type { Config } from "../../../core/config";
import { simulateDeallocate, type SimulateDeallocateParameters } from "../actions/simulate-deallocate";

/**
 * Build TanStack Mutation options for {@link simulateDeallocate} — an on-demand
 * dry-run (`simulateContract`) of deallocate.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(simulateDeallocateMutationOptions(config));
 * ```
 */
export function simulateDeallocateMutationOptions(config: Config) {
  return {
    mutationKey: ["simulateDeallocate"] as const,
    mutationFn: (variables: SimulateDeallocateParameters) => simulateDeallocate(config, variables),
  };
}
