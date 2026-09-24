import type { Config } from "../../core/config";
import { refundMarket, type RefundMarketParameters, type RefundMarketReturnType } from "./refund-market";

/**
 * Build TanStack Mutation options for {@link refundMarket}. Modeled as a mutation:
 * it moves a deposit back to the user, so it is a one-shot write, not cached data.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * const { mutateAsync } = useMutation(refundMarketMutationOptions(config));
 * await mutateAsync({
 *   accessToken: token.accessToken,
 *   marketAddress: rejectedMarket.contractAddress,
 *   depositChain: rejectedMarket.chainId,
 *   recipientAddress: account.address,
 * });
 * ```
 */
export function refundMarketMutationOptions(config: Config) {
  return {
    mutationKey: ["refundMarket"] as const,
    mutationFn: (variables: RefundMarketParameters): Promise<RefundMarketReturnType> => refundMarket(config, variables),
  };
}
