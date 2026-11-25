"use client";

import {
  listMarketMutationOptions,
  type ConfigParameter,
  type CreatedPool,
  type ListMarketParameters,
  type ListMarketReturnType,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useListMarket}: just an optional `config`. */
export type UseListMarketParameters = ConfigParameter;

/**
 * Variables for the {@link useListMarket} mutation — the same shape as core's
 * {@link ListMarketParameters}.
 *
 * `accessToken`, `tokenContractAddress`, `buyBackRatio`, `maxLeverage`, and
 * `depositChain` are required; every other field is an optional listing extra
 * (`isTax`, `userWhitelistTax`, `additionalChains`, `poolAddress`, `cexList`),
 * sent only when set. `chainId` defaults to the connected chain when omitted.
 */
export type ListMarketVariables = ListMarketParameters;

/**
 * Return type of {@link useListMarket}: the created or relisted pool on success
 * (including the deposit wallet to fund it) or a normalized error.
 */
export type UseListMarketReturnType = UseMutationResult<CreatedPool, SymmioRequestError, ListMarketVariables>;

/**
 * List a token — or relist a delisted one — with the listing backend in one call.
 *
 * The mutation POSTs the token and its pool economics to the listing service's
 * list-market route with the caller's Bearer `accessToken` (mint it with
 * {@link useAuthenticateListing}), and resolves to the accepted
 * {@link CreatedPool}. For a new token the service opens a listing; for a
 * delisted market it relists it through the same flow. Either way the result
 * carries the custodial `walletPublicKey` to send the listing deposit to, and the
 * pool stays at `WAITING_FOR_DEPOSIT` until it lands.
 *
 * On success it invalidates every mounted catalog ({@link useListingMarkets}),
 * Your Pools ({@link useUserListingMarkets}), market detail
 * ({@link useListingMarketDetail}), listing status ({@link useListingStatus})
 * and weekly limit ({@link useWeeklyListingLimit}) query — a listing adds the
 * pool and uses a weekly slot, and a relist moves the market off `DELISTED`.
 *
 * Required variables: `accessToken`, `tokenContractAddress`, `buyBackRatio`
 * (`0`–`100`), `maxLeverage` (`1`–`100`), and `depositChain`. The optional extras
 * are the caller's to default. Pools is **chain-level** — `mutate` /
 * `mutateAsync` reject with a normalized {@link SymmioRequestError}
 * (`LISTING_NOT_CONFIGURED`) on a chain with no listing backend. Every service
 * rejection — a bad or expired token (`401`), a market that already exists and
 * is not delisted, a failed token validation, the weekly limit — comes back as
 * `LIST_MARKET_FAILED` with the service's `status` and `responseData`.
 *
 * Replaces the deprecated {@link useAddMarket}, which takes the same variables.
 *
 * @example
 * ```tsx
 * const list = useListMarket();
 * list.mutate({
 *   accessToken, // from useAuthenticateListing
 *   tokenContractAddress: "0xToken…",
 *   buyBackRatio: 5,
 *   maxLeverage: 20,
 *   depositChain: ListingDepositChainId.BASE,
 * });
 * // …later: send the listing deposit to `list.data?.walletPublicKey`.
 * ```
 */
export function useListMarket(parameters: UseListMarketParameters = {}): UseListMarketReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const options = listMarketMutationOptions(config);

  return useMutation({
    ...options,
    mutationFn: async (variables: ListMarketVariables): Promise<ListMarketReturnType> => {
      try {
        return await options.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: () => {
      // A listing joins the catalog and the caller's "Your Pools" and uses a
      // weekly slot; a relist also moves the market off DELISTED. Invalidate each
      // by key tag so every mounted view refetches, whatever its parameters.
      void queryClient.invalidateQueries({ queryKey: ["getListingMarkets"] });
      void queryClient.invalidateQueries({ queryKey: ["getUserListingMarkets"] });
      void queryClient.invalidateQueries({ queryKey: ["getListingMarketDetail"] });
      void queryClient.invalidateQueries({ queryKey: ["getListingStatus"] });
      void queryClient.invalidateQueries({ queryKey: ["getWeeklyListingLimit"] });
    },
  }) as UseListMarketReturnType;
}
