import type { Config } from "../../../core/config";
import type { AuthenticateSolverParameters } from "../types";
import { authenticateSolver } from "./authenticate-solver";

/**
 * Exchange a consumer-signed legacy challenge through TanStack Mutation.
 * @param config - Selected SDK deployment.
 * @returns Mutation options; no retries, signing, storage or cache invalidation.
 * @example const options = authenticateSolverMutationOptions(config);
 */
export function authenticateSolverMutationOptions(config: Config) {
  return {
    mutationKey: ["authenticateSolver"] as const,
    retry: false,
    gcTime: 0,
    mutationFn: (variables: AuthenticateSolverParameters) => authenticateSolver(config, variables),
  };
}
