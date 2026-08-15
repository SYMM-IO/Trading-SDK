import type { Config } from "../../../core/config";
import { withdrawAuto, type WithdrawAutoParameters } from "../actions/withdraw-auto";

/**
 * Build TanStack Mutation options for {@link withdrawAuto}.
 *
 * The returned `mutationFn` takes the action's minimal parameters
 * (`{ account, amount, receiver, … }`, `amount` in the collateral token's
 * decimals) and forwards them to `withdrawAuto(config, …)`, which reads the
 * subaccount's isolation, builds the withdraw part, scales the deallocate amount,
 * and dispatches. Framework layers compose `onSuccess` invalidation (e.g. of the
 * subaccount's balance reads plus the pending-requests and withdrawable-time reads)
 * and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(withdrawAutoMutationOptions(config));
 * ```
 */
export function withdrawAutoMutationOptions(config: Config) {
  return {
    mutationKey: ["withdrawAuto"] as const,
    mutationFn: (variables: WithdrawAutoParameters) => withdrawAuto(config, variables),
  };
}
