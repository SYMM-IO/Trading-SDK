import type { Config } from "../../core/config";
import { addSolverWhitelist, type AddSolverWhitelistParameters } from "./add-solver-whitelist";

/**
 * Build TanStack Mutation options for {@link addSolverWhitelist}. Modeled as a
 * mutation (not a query): the endpoint mutates solver-side whitelist state.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(addSolverWhitelistMutationOptions(config));
 * ```
 */
export function addSolverWhitelistMutationOptions(config: Config) {
  return {
    mutationKey: ["addSolverWhitelist"] as const,
    mutationFn: (variables: AddSolverWhitelistParameters) => addSolverWhitelist(config, variables),
  };
}
