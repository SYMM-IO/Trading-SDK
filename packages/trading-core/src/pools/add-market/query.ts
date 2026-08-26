import type { Config } from "../../core/config";
import { addMarket, type AddMarketParameters, type AddMarketReturnType } from "./add-market";

/**
 * Build TanStack Mutation options for {@link addMarket}. Modeled as a mutation
 * (not a query): it submits a create-pool application that provisions a deposit
 * wallet, so it is a one-shot write, not cached data.
 *
 * @param config - The SDK config.
 * @returns Options to pass to `useMutation`.
 *
 * @example
 * ```ts
 * const { mutateAsync } = useMutation(addMarketMutationOptions(config));
 * const pool = await mutateAsync({
 *   accessToken: token.accessToken,
 *   tokenContractAddress: "0xToken…",
 *   buyBackRatio: 50,
 *   maxLeverage: 20,
 *   depositChain: ListingDepositChainId.BASE,
 * });
 * ```
 */
export function addMarketMutationOptions(config: Config) {
  return {
    mutationKey: ["addMarket"] as const,
    mutationFn: (variables: AddMarketParameters): Promise<AddMarketReturnType> => addMarket(config, variables),
  };
}
