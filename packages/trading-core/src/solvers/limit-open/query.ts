import type { Config } from "../../core/config";
import { limitOpenAuto } from "./limit-open-auto";
import type { PrepareLimitOpenParameters } from "./prepare-limit-open-params";

/**
 * Build TanStack Mutation options for `limitOpenAuto`.
 *
 * @example
 * ```ts
 * useMutation(limitOpenAutoMutationOptions(config));
 * ```
 */
export function limitOpenAutoMutationOptions(config: Config) {
  return {
    mutationKey: ["limitOpenAuto"] as const,
    mutationFn: (variables: PrepareLimitOpenParameters) => limitOpenAuto(config, variables),
  };
}
