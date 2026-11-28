import type { Config } from "../../core/config";
import { listMarket, type ListMarketParameters, type ListMarketReturnType } from "./list-market";

/**
 * Build TanStack Mutation options for {@link listMarket}. Modeled as a mutation
 * (not a query): it submits a listing — or relisting — application that
 * provisions a deposit wallet, so it is a one-shot write, not cached data.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * const { mutateAsync } = useMutation(listMarketMutationOptions(config));
 * const pool = await mutateAsync({
 *   accessToken: token.accessToken,
 *   tokenContractAddress: "0xToken…",
 *   buyBackRatio: 50,
 *   maxLeverage: 20,
 *   depositChain: ListingDepositChainId.BASE,
 * });
 * ```
 */
export function listMarketMutationOptions(config: Config) {
  return {
    mutationKey: ["listMarket"] as const,
    mutationFn: (variables: ListMarketParameters): Promise<ListMarketReturnType> => listMarket(config, variables),
  };
}
