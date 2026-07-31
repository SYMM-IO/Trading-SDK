import type { SymmioSolverKind } from "../../../core/chains/types";
import type { Config } from "../../../core/config";
import { instantOpen } from "./instant-open";
import type { InstantOpenParameters, InstantOpenReturnType } from "./types";

/**
 * Build TanStack Mutation options for the pure {@link instantOpen} primitive.
 *
 * Generic over the solver kind so a caller that always targets one solver keeps
 * the narrowed variables and result: `instantOpenMutationOptions<"rasa">(config)`.
 * Left unbound, the variables are the union and the result is discriminated on
 * `kind`.
 *
 * @example
 * ```ts
 * useMutation(instantOpenMutationOptions(config));
 * ```
 */
export function instantOpenMutationOptions<K extends SymmioSolverKind = SymmioSolverKind>(config: Config) {
  return {
    mutationKey: ["instantOpen"] as const,
    mutationFn: (variables: InstantOpenParameters<K>): Promise<InstantOpenReturnType<K>> =>
      instantOpen<K>(config, variables),
  };
}
