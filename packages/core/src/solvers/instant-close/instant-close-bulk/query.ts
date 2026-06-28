import type { Config } from "../../../core/config";
import { instantCloseBulk, type InstantCloseBulkParameters } from "./instant-close-bulk";

/**
 * Build TanStack Mutation options for the pure {@link instantCloseBulk}
 * primitive.
 *
 * @example
 * ```ts
 * useMutation(instantCloseBulkMutationOptions(config));
 * ```
 */
export function instantCloseBulkMutationOptions(config: Config) {
  return {
    mutationKey: ["instantCloseBulk"] as const,
    mutationFn: (variables: InstantCloseBulkParameters) => instantCloseBulk(config, variables),
  };
}
