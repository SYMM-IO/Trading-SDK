import type { Config } from "../../../core/config";
import { allocate, type AllocateParameters } from "../actions/allocate";

/**
 * Build TanStack Mutation options for {@link allocate}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `allocate(config, …)`. Framework layers compose `onSuccess` invalidation (e.g.
 * of the subaccount's balance reads) and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(allocateMutationOptions(config));
 * ```
 */
export function allocateMutationOptions(config: Config) {
  return {
    mutationKey: ["allocate"] as const,
    mutationFn: (variables: AllocateParameters) => allocate(config, variables),
  };
}
