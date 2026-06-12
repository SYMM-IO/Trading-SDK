import type { Config } from "../../../core/config";
import { removeMargin, type RemoveMarginParameters } from "../actions/remove-margin";

/**
 * Build TanStack Mutation options for {@link removeMargin}.
 *
 * The returned `mutationFn` takes the action's parameters (including a freshly
 * fetched `upnlSig`) and forwards them to `removeMargin(config, …)`. Framework
 * layers compose the Muon-signature fetch, `onSuccess` invalidation, and error
 * normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(removeMarginMutationOptions(config));
 * ```
 */
export function removeMarginMutationOptions(config: Config) {
  return {
    mutationKey: ["removeMargin"] as const,
    mutationFn: (variables: RemoveMarginParameters) => removeMargin(config, variables),
  };
}
