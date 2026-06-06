import type { Config } from "../../../core/config";
import { finalizeWithdrawRequest, type FinalizeWithdrawRequestParameters } from "../actions/finalize-withdraw-request";

/**
 * Build TanStack Mutation options for {@link finalizeWithdrawRequest}.
 *
 * The returned `mutationFn` takes the action's parameters and forwards them to
 * `finalizeWithdrawRequest(config, …)`. Framework layers compose `onSuccess`
 * invalidation (e.g. of the pending-requests read) and error normalization on top.
 *
 * @param config - The SDK config (must have a `getWalletClient` resolver).
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * useMutation(finalizeWithdrawRequestMutationOptions(config));
 * ```
 */
export function finalizeWithdrawRequestMutationOptions(config: Config) {
  return {
    mutationKey: ["finalizeWithdrawRequest"] as const,
    mutationFn: (variables: FinalizeWithdrawRequestParameters) => finalizeWithdrawRequest(config, variables),
  };
}
