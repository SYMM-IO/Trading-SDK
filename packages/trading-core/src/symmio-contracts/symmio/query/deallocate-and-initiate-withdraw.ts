import type { Config } from "../../../core/config";
import {
  deallocateAndInitiateWithdraw,
  type DeallocateAndInitiateWithdrawParameters,
} from "../actions/deallocate-and-initiate-withdraw";

/**
 * Build TanStack Mutation options for {@link deallocateAndInitiateWithdraw}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `deallocateAndInitiateWithdraw(config, …)`. Framework layers compose `onSuccess`
 * invalidation (e.g. of the subaccount's balance reads plus the pending-requests
 * and withdrawable-time reads), Muon-signature fetching, and error normalization
 * on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(deallocateAndInitiateWithdrawMutationOptions(config));
 * ```
 */
export function deallocateAndInitiateWithdrawMutationOptions(config: Config) {
  return {
    mutationKey: ["deallocateAndInitiateWithdraw"] as const,
    mutationFn: (variables: DeallocateAndInitiateWithdrawParameters) =>
      deallocateAndInitiateWithdraw(config, variables),
  };
}
