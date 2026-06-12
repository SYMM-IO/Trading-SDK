import type { Config } from "../../../core/config";
import { deallocate, type DeallocateParameters } from "../actions/deallocate";

/**
 * Build TanStack Mutation options for {@link deallocate}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `deallocate(config, …)`. Framework layers compose `onSuccess` invalidation (e.g.
 * of the subaccount's balance reads), Muon-signature fetching, and error
 * normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(deallocateMutationOptions(config));
 * ```
 */
export function deallocateMutationOptions(config: Config) {
  return {
    mutationKey: ["deallocate"] as const,
    mutationFn: (variables: DeallocateParameters) => deallocate(config, variables),
  };
}
