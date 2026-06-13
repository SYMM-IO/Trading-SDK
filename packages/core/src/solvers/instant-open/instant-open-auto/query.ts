import type { Config } from "../../../core/config";
import type { PrepareInstantOpenParameters } from "../prepare-instant-open-params/prepare-instant-open-params";
import { instantOpenAuto } from "./instant-open-auto";

/**
 * Build TanStack Mutation options for `instantOpenAuto`.
 *
 * @example
 * ```ts
 * useMutation(instantOpenAutoMutationOptions(config));
 * ```
 */
export function instantOpenAutoMutationOptions(config: Config) {
  return {
    mutationKey: ["instantOpenAuto"] as const,
    mutationFn: (variables: PrepareInstantOpenParameters) => instantOpenAuto(config, variables),
  };
}
