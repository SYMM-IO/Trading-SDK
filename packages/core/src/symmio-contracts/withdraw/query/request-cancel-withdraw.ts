import type { Config } from "../../../core/config";
import { requestCancelWithdraw, type RequestCancelWithdrawParameters } from "../actions/request-cancel-withdraw";

/**
 * Build TanStack Mutation options for {@link requestCancelWithdraw}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `requestCancelWithdraw(config, …)`. Framework layers compose `onSuccess`
 * invalidation (e.g. of the pending-requests read) and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(requestCancelWithdrawMutationOptions(config));
 * ```
 */
export function requestCancelWithdrawMutationOptions(config: Config) {
  return {
    mutationKey: ["requestCancelWithdraw"] as const,
    mutationFn: (variables: RequestCancelWithdrawParameters) => requestCancelWithdraw(config, variables),
  };
}
