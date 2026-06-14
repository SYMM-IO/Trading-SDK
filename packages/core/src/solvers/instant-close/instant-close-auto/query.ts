import type { Config } from "../../../core/config";
import { instantCloseAuto } from "./instant-close-auto";
import type { PrepareInstantCloseParameters } from "../prepare-instant-close-params/prepare-instant-close-params";

/**
 * Build TanStack Mutation options for {@link instantCloseAuto}.
 *
 * @example
 * ```ts
 * useMutation(instantCloseAutoMutationOptions(config));
 * ```
 */
export function instantCloseAutoMutationOptions(config: Config) {
  return {
    mutationKey: ["instantCloseAuto"] as const,
    mutationFn: (variables: PrepareInstantCloseParameters) => instantCloseAuto(config, variables),
  };
}
