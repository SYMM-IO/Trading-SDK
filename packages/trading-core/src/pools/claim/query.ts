import type { Config } from "../../core/config";
import { claimProfit, type ClaimProfitParameters, type ClaimProfitReturnType } from "./claim-profit";

/**
 * Build TanStack Mutation options for {@link claimProfit}. Modeled as a mutation
 * (not a query): it moves USDC and shifts the user's claimable/claimed balances,
 * so it is a one-shot write, not cached data.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * const { mutateAsync } = useMutation(claimProfitMutationOptions(config));
 * const receipt = await mutateAsync({
 *   accessToken: token.accessToken,
 *   tokenContractAddress: "0xToken…",
 *   depositChain: market.chainId,
 *   accountAddress: "0xSubAccount…",
 *   amount: profit.claimableReward,
 * });
 * ```
 */
export function claimProfitMutationOptions(config: Config) {
  return {
    mutationKey: ["claimProfit"] as const,
    mutationFn: (variables: ClaimProfitParameters): Promise<ClaimProfitReturnType> => claimProfit(config, variables),
  };
}
