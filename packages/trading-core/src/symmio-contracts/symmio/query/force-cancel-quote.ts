import type { Config } from "../../../core/config";
import { forceCancelQuote, type ForceCancelQuoteParameters } from "../actions/force-cancel-quote";

/**
 * Build TanStack Mutation options for {@link forceCancelQuote}.
 *
 * Framework layers compose `onSuccess` invalidation (e.g. of the pending-quotes
 * reads) and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(forceCancelQuoteMutationOptions(config));
 * ```
 */
export function forceCancelQuoteMutationOptions(config: Config) {
  return {
    mutationKey: ["forceCancelQuote"] as const,
    mutationFn: (variables: ForceCancelQuoteParameters) => forceCancelQuote(config, variables),
  };
}
