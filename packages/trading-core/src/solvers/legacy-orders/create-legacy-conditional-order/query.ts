import type { Config } from "../../../core/config";
import type { CreateLegacyConditionalOrderParameters } from "../types";
import { createLegacyConditionalOrder } from "./create-legacy-conditional-order";

/**
 * Submit a legacy bearer-authenticated conditional order through TanStack Mutation.
 * @param config - Selected SDK deployment.
 * @returns Mutation options; no retries, signing, storage or cache invalidation.
 * @example const options = createLegacyConditionalOrderMutationOptions(config);
 */
export function createLegacyConditionalOrderMutationOptions(config: Config) {
  return {
    mutationKey: ["createLegacyConditionalOrder"] as const,
    retry: false,
    gcTime: 0,
    mutationFn: (variables: CreateLegacyConditionalOrderParameters) => createLegacyConditionalOrder(config, variables),
  };
}
