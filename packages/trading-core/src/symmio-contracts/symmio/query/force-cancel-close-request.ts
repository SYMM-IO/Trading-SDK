import type { Config } from "../../../core/config";
import { forceCancelCloseRequest, type ForceCancelCloseRequestParameters } from "../actions/force-cancel-close-request";

/**
 * Build TanStack Mutation options for {@link forceCancelCloseRequest}.
 *
 * Framework layers compose `onSuccess` invalidation (e.g. of the open-positions
 * reads) and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(forceCancelCloseRequestMutationOptions(config));
 * ```
 */
export function forceCancelCloseRequestMutationOptions(config: Config) {
  return {
    mutationKey: ["forceCancelCloseRequest"] as const,
    mutationFn: (variables: ForceCancelCloseRequestParameters) => forceCancelCloseRequest(config, variables),
  };
}
