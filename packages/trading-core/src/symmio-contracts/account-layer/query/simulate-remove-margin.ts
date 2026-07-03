import type { Config } from "../../../core/config";
import { simulateRemoveMargin, type SimulateRemoveMarginParameters } from "../actions/simulate-remove-margin";

/**
 * Build TanStack Mutation options for {@link simulateRemoveMargin} — an on-demand
 * dry-run (`simulateContract`) of removeMargin.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(simulateRemoveMarginMutationOptions(config));
 * ```
 */
export function simulateRemoveMarginMutationOptions(config: Config) {
  return {
    mutationKey: ["simulateRemoveMargin"] as const,
    mutationFn: (variables: SimulateRemoveMarginParameters) => simulateRemoveMargin(config, variables),
  };
}
