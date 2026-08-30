"use client";

import {
  updateListingMarketConfigMutationOptions,
  type ConfigParameter,
  type UpdateListingMarketConfigParameters,
  type UpdateListingMarketConfigReturnType,
} from "@symmio/trading-core";
import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useUpdateListingMarketConfig}: just an optional `config`. */
export type UseUpdateListingMarketConfigParameters = ConfigParameter;

/**
 * Variables for the {@link useUpdateListingMarketConfig} mutation — the same
 * shape as core's {@link UpdateListingMarketConfigParameters}.
 *
 * `accessToken`, `tokenContractAddress`, and `depositChain` are required, along
 * with at least one of `maxLeverage` / `buybackRatio`. `chainId` defaults to the
 * connected chain when omitted, and `ensureDepositAddress` defaults to `true`.
 */
export type UpdateListingMarketConfigVariables = UpdateListingMarketConfigParameters;

/**
 * Return type of {@link useUpdateListingMarketConfig}: resolves to the pool's
 * `ListingMarketConfig` after the opinion is recorded, or a normalized error.
 */
export type UseUpdateListingMarketConfigReturnType = UseMutationResult<
  UpdateListingMarketConfigReturnType,
  SymmioRequestError,
  UpdateListingMarketConfigVariables
>;

/**
 * Submit the signed-in user's configuration opinion for one pool — their
 * preferred max leverage, buyback percentage, or both.
 *
 * This never overwrites the pool's configuration. The listing service records
 * the value as *this LP's* opinion and folds it into a deposit-weighted average
 * across every LP, so one call nudges the pool rather than setting it. The
 * mutation resolves to the config after the blend: `userMaxLeverage` /
 * `userBuybackRatio` are what was just recorded, `maxLeverage` / `buybackRatio`
 * are the new pool values. Both are plain whole numbers — `50` is 50%, `20` is
 * 20x — bounded by `LISTING_MARKET_CONFIG_BOUNDS`.
 *
 * The caller's deposit wallet is minted first by default (see
 * `ensureDepositAddress`), because the service only counts an opinion from an LP
 * that holds one. On success `getListingMarketConfig` and
 * `getListingMarketDetail` are invalidated so any mounted view re-reads the new
 * blend.
 *
 * The endpoint is capped at
 * `useListingConfig().data.rateLimits.marketConfigUpdatesPerDay` successful
 * updates per pool in a rolling 24-hour window; exceeding it surfaces as a
 * `429`. Pools is **chain-level** — `mutate` / `mutateAsync` reject with a
 * normalized {@link SymmioRequestError} (`LISTING_NOT_CONFIGURED`) on a chain
 * with no listing backend, and a bad or expired token comes back as an
 * `UPDATE_LISTING_MARKET_CONFIG_FAILED` `401`.
 *
 * @example
 * ```tsx
 * const update = useUpdateListingMarketConfig();
 *
 * update.mutate({
 *   accessToken, // from useAuthenticateListing
 *   tokenContractAddress,
 *   depositChain: market.chainId,
 *   buybackRatio: 50, // 50%
 *   maxLeverage: 20, // 20x
 * });
 * ```
 */
export function useUpdateListingMarketConfig(
  parameters: UseUpdateListingMarketConfigParameters = {},
): UseUpdateListingMarketConfigReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const queryClient = useQueryClient();
  const options = updateListingMarketConfigMutationOptions(config);

  return useMutation({
    ...options,
    mutationFn: async (variables: UpdateListingMarketConfigVariables): Promise<UpdateListingMarketConfigReturnType> => {
      try {
        return await options.mutationFn({ ...variables, chainId: variables.chainId ?? chainId });
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
    onSuccess: () => {
      // The opinion changes both halves of the config: the caller's own values
      // and the pool-level blend `getListingMarketDetail` reports. Invalidate
      // both by key tag so mounted views refetch — the caller does not
      // invalidate these by hand.
      void queryClient.invalidateQueries({ queryKey: ["getListingMarketConfig"] });
      void queryClient.invalidateQueries({ queryKey: ["getListingMarketDetail"] });
    },
  }) as UseUpdateListingMarketConfigReturnType;
}
