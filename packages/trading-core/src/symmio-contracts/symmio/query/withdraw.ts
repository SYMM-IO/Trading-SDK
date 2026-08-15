import type { Config } from "../../../core/config";
import { withdraw, type WithdrawParameters } from "../actions/withdraw";

/**
 * Build TanStack Mutation options for {@link withdraw}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `withdraw(config, …)`, which dispatches by the subaccount's isolation type
 * (`CUSTOM` → deallocate + initiate; `MARKET` / `MARKET_DIRECTION` → initiate
 * only). Framework layers compose `onSuccess` invalidation (e.g. of the
 * subaccount's balance reads plus the pending-requests and withdrawable-time
 * reads) and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(withdrawMutationOptions(config));
 * ```
 */
export function withdrawMutationOptions(config: Config) {
  return {
    mutationKey: ["withdraw"] as const,
    mutationFn: (variables: WithdrawParameters) => withdraw(config, variables),
  };
}
