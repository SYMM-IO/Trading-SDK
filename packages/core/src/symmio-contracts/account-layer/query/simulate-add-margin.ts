import type { Config } from "../../../core/config";
import { simulateAddMargin, type SimulateAddMarginParameters } from "../actions/simulate-add-margin";

/**
 * Build TanStack Mutation options for {@link simulateAddMargin} — an on-demand
 * dry-run (`simulateContract`) of addMargin.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(simulateAddMarginMutationOptions(config));
 * ```
 */
export function simulateAddMarginMutationOptions(config: Config) {
  return {
    mutationKey: ["simulateAddMargin"] as const,
    mutationFn: (variables: SimulateAddMarginParameters) => simulateAddMargin(config, variables),
  };
}
