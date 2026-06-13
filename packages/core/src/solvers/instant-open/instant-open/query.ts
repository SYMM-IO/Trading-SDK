import type { Config } from "../../../core/config";
import { instantOpen, type InstantOpenParameters } from "./instant-open";

/**
 * Build TanStack Mutation options for the pure {@link instantOpen} primitive.
 *
 * @example
 * ```ts
 * useMutation(instantOpenMutationOptions(config));
 * ```
 */
export function instantOpenMutationOptions(config: Config) {
  return {
    mutationKey: ["instantOpen"] as const,
    mutationFn: (variables: InstantOpenParameters) => instantOpen(config, variables),
  };
}
