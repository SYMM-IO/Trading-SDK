import type { Config } from "../../../core/config";
import { addMargin, type AddMarginParameters } from "../actions/add-margin";

/**
 * Build TanStack Mutation options for {@link addMargin}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `addMargin(config, …)`. Framework layers compose `onSuccess` invalidation
 * (e.g. of the VA's balance reads) and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(addMarginMutationOptions(config));
 * ```
 */
export function addMarginMutationOptions(config: Config) {
  return {
    mutationKey: ["addMargin"] as const,
    mutationFn: (variables: AddMarginParameters) => addMargin(config, variables),
  };
}
