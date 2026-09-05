import type { Config } from "../../../core/config";
import {
  requestToCancelCloseRequest,
  type RequestToCancelCloseRequestParameters,
} from "../actions/request-to-cancel-close-request";

/**
 * Build TanStack Mutation options for {@link requestToCancelCloseRequest}.
 *
 * Framework layers compose `onSuccess` invalidation (e.g. of the open-positions
 * reads) and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(requestToCancelCloseRequestMutationOptions(config));
 * ```
 */
export function requestToCancelCloseRequestMutationOptions(config: Config) {
  return {
    mutationKey: ["requestToCancelCloseRequest"] as const,
    mutationFn: (variables: RequestToCancelCloseRequestParameters) => requestToCancelCloseRequest(config, variables),
  };
}
