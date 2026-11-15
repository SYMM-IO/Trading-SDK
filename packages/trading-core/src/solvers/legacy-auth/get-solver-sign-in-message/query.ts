import type { Config } from "../../../core/config";
import type { GetSolverSignInMessageParameters } from "../types";
import { getSolverSignInMessage } from "./get-solver-sign-in-message";

/**
 * Fetch an unsigned legacy sign-in challenge on demand through TanStack Mutation.
 * @param config - Selected SDK deployment.
 * @returns Mutation options; no retries, signing, storage or cache invalidation.
 * @example const options = getSolverSignInMessageMutationOptions(config);
 */
export function getSolverSignInMessageMutationOptions(config: Config) {
  return {
    mutationKey: ["getSolverSignInMessage"] as const,
    retry: false,
    gcTime: 0,
    mutationFn: (variables: GetSolverSignInMessageParameters) => getSolverSignInMessage(config, variables),
  };
}
