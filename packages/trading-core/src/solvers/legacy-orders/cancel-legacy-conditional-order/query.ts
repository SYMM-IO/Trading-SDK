import type { Config } from "../../../core/config";
import type { CancelLegacyConditionalOrderParameters } from "../types";
import { cancelLegacyConditionalOrder } from "./cancel-legacy-conditional-order";

/**
 * Cancel a legacy bearer-authenticated conditional order through TanStack Mutation.
 * @param config - Selected SDK deployment.
 * @returns Mutation options; no retries, signing, storage or cache invalidation.
 * @example const options = cancelLegacyConditionalOrderMutationOptions(config);
 */
export function cancelLegacyConditionalOrderMutationOptions(config: Config) {
  return {
    mutationKey: ["cancelLegacyConditionalOrder"] as const,
    retry: false,
    gcTime: 0,
    mutationFn: (variables: CancelLegacyConditionalOrderParameters) => cancelLegacyConditionalOrder(config, variables),
  };
}
