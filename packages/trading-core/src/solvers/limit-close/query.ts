import type { Config } from "../../core/config";
import { limitCloseAuto } from "./limit-close-auto";
import type { PrepareLimitCloseParameters } from "./prepare-limit-close-params";

/**
 * Build TanStack Mutation options for `limitCloseAuto`.
 *
 * @example
 * ```ts
 * useMutation(limitCloseAutoMutationOptions(config));
 * ```
 */
export function limitCloseAutoMutationOptions(config: Config) {
  return {
    mutationKey: ["limitCloseAuto"] as const,
    mutationFn: (variables: PrepareLimitCloseParameters) => limitCloseAuto(config, variables),
  };
}
