import type { Config } from "../../../core/config";
import { initiateWithdraw, type InitiateWithdrawParameters } from "../actions/initiate-withdraw";

/**
 * Build TanStack Mutation options for {@link initiateWithdraw}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `initiateWithdraw(config, …)`. Framework layers compose `onSuccess` invalidation
 * (e.g. of the pending-requests and withdrawable-time reads) and error
 * normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(initiateWithdrawMutationOptions(config));
 * ```
 */
export function initiateWithdrawMutationOptions(config: Config) {
  return {
    mutationKey: ["initiateWithdraw"] as const,
    mutationFn: (variables: InitiateWithdrawParameters) => initiateWithdraw(config, variables),
  };
}
