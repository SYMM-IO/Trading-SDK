import type { Config } from "../../../core/config";
import { requestToCancelQuote, type RequestToCancelQuoteParameters } from "../actions/request-to-cancel-quote";

/**
 * Build TanStack Mutation options for {@link requestToCancelQuote}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `requestToCancelQuote(config, …)`. Framework layers compose `onSuccess`
 * invalidation (e.g. of the pending-quotes reads) and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(requestToCancelQuoteMutationOptions(config));
 * ```
 */
export function requestToCancelQuoteMutationOptions(config: Config) {
  return {
    mutationKey: ["requestToCancelQuote"] as const,
    mutationFn: (variables: RequestToCancelQuoteParameters) => requestToCancelQuote(config, variables),
  };
}
