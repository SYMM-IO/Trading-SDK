import type { Config } from "../../core/config";
import { withdrawLp, type WithdrawLpParameters, type WithdrawLpReturnType } from "./withdraw-lp";

/**
 * Build TanStack Mutation options for {@link withdrawLp}. Modeled as a mutation
 * (not a query): it queues a withdrawal that mutates the user's pending-withdrawal
 * balance, so it is a one-shot write, not cached data.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * const { mutateAsync } = useMutation(withdrawLpMutationOptions(config));
 * await mutateAsync({
 *   accessToken: token.accessToken,
 *   marketAddress: "0xToken…",
 *   withdrawAddress: "0xRecipient…",
 *   amount: profit.availableLpAmount,
 * });
 * ```
 */
export function withdrawLpMutationOptions(config: Config) {
  return {
    mutationKey: ["withdrawLp"] as const,
    mutationFn: (variables: WithdrawLpParameters): Promise<WithdrawLpReturnType> => withdrawLp(config, variables),
  };
}
