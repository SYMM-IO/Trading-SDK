import type { Config } from "../../../core/config";
import { instantClose, type InstantCloseParameters } from "./instant-close";

/**
 * Build TanStack Mutation options for the pure {@link instantClose} primitive.
 *
 * @example
 * ```ts
 * useMutation(instantCloseMutationOptions(config));
 * ```
 */
export function instantCloseMutationOptions(config: Config) {
  return {
    mutationKey: ["instantClose"] as const,
    mutationFn: (variables: InstantCloseParameters) => instantClose(config, variables),
  };
}
