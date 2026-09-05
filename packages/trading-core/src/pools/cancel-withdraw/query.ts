import type { Config } from "../../core/config";
import { cancelWithdraw, type CancelWithdrawParameters, type CancelWithdrawReturnType } from "./cancel-withdraw";

/**
 * Build TanStack Mutation options for {@link cancelWithdraw}. Modeled as a
 * mutation: it removes a queued withdrawal and returns the shares to the user's
 * available balance, so it is a one-shot write, not cached data.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * const { mutateAsync } = useMutation(cancelWithdrawMutationOptions(config));
 * await mutateAsync({ accessToken: token.accessToken, withdrawId: pending.transactionId });
 * ```
 */
export function cancelWithdrawMutationOptions(config: Config) {
  return {
    mutationKey: ["cancelWithdraw"] as const,
    mutationFn: (variables: CancelWithdrawParameters): Promise<CancelWithdrawReturnType> =>
      cancelWithdraw(config, variables),
  };
}
