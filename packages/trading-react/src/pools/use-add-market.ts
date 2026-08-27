"use client";

import {
  addMarketMutationOptions,
  type AddMarketParameters,
  type AddMarketReturnType,
  type ConfigParameter,
  type CreatedPool,
} from "@symmio/trading-core";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useAddMarket}: just an optional `config`. */
export type UseAddMarketParameters = ConfigParameter;

/**
 * Variables for the {@link useAddMarket} mutation — the same shape as core's
 * {@link AddMarketParameters}.
 *
 * `accessToken`, `tokenContractAddress`, `buyBackRatio`, `maxLeverage`, and
 * `depositChain` are required; every other field is an optional listing extra
 * (`isTax`, `userWhitelistTax`, `additionalChains`, `poolAddress`, `cexList`),
 * sent only when set. `chainId` defaults to the connected chain when omitted.
 */
export type AddMarketVariables = AddMarketParameters;

/**
 * Return type of {@link useAddMarket}: the created pool on success (including the
 * deposit wallet to seed it) or a normalized error.
 */
export type UseAddMarketReturnType = UseMutationResult<CreatedPool, SymmioRequestError, AddMarketVariables>;

/**
 * Create a pool — list a new token with the listing backend in one call.
 *
 * The mutation POSTs the token and its pool economics to the listing service
 * with the caller's Bearer `accessToken` (mint it with {@link useAuthenticateListing}),
 * and resolves to the accepted {@link CreatedPool}. That result carries the
 * custodial `walletPublicKey` the service provisioned — send the listing deposit
 * there to seed the pool, which stays at `WAITING_FOR_DEPOSIT` until it lands.
 *
 * Required variables: `accessToken`, `tokenContractAddress`, `buyBackRatio`
 * (`0`–`100`), `maxLeverage` (`1`–`100`), and `depositChain`. The optional extras
 * are the caller's to default. Pools is **chain-level** — `mutate` /
 * `mutateAsync` reject with a normalized {@link SymmioRequestError}
 * (`LISTING_NOT_CONFIGURED`) on a chain with no listing backend, and a bad or
 * expired token comes back as an `ADD_MARKET_FAILED` `401`. Failures are
 * normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const create = useAddMarket();
 * create.mutate({
 *   accessToken, // from useAuthenticateListing
 *   tokenContractAddress: "0xToken…",
 *   buyBackRatio: 5,
 *   maxLeverage: 20,
 *   depositChain: ListingDepositChainId.HYPER_EVM,
 * });
 * // …later: send the listing deposit to `create.data?.walletPublicKey`.
 * ```
 */
export function useAddMarket(parameters: UseAddMarketParameters = {}): UseAddMarketReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = addMarketMutationOptions(config);

  return useMutation({
    ...options,
    mutationFn: async (variables: AddMarketVariables): Promise<AddMarketReturnType> => {
      try {
        return await options.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseAddMarketReturnType;
}
