import type { Config } from "../../../core/config";
import { instantCloseBulkAuto, type InstantCloseBulkAutoParameters } from "./instant-close-bulk-auto";

/**
 * Build TanStack Mutation options for {@link instantCloseBulkAuto}.
 *
 * @example
 * ```ts
 * useMutation(instantCloseBulkAutoMutationOptions(config));
 * ```
 */
export function instantCloseBulkAutoMutationOptions(config: Config) {
  return {
    mutationKey: ["instantCloseBulkAuto"] as const,
    mutationFn: (variables: InstantCloseBulkAutoParameters) => instantCloseBulkAuto(config, variables),
  };
}
