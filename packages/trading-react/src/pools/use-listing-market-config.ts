"use client";

import {
  getListingMarketConfigQueryOptions,
  type ConfigParameter,
  type GetListingMarketConfigOptions,
  type GetListingMarketConfigReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useListingMarketConfig}: the core query options plus an optional `config`. */
export type UseListingMarketConfigParameters = GetListingMarketConfigOptions & ConfigParameter;

/**
 * Return type of {@link useListingMarketConfig}: the signed-in user's config
 * opinion for one pool, plus the pool values in force.
 */
export type UseListingMarketConfigReturnType = UseQueryResult<GetListingMarketConfigReturnType, SymmioRequestError>;

/**
 * Read the signed-in user's configuration opinion for one pool — their own max
 * leverage and buyback percentage, alongside the deposit-weighted pool values
 * those opinions blend into.
 *
 * Use it to prefill an edit form with what the caller previously set:
 * `userMaxLeverage` and `userBuybackRatio` are `null` until they have ever
 * submitted an opinion for this pool. Both ratios are plain whole numbers —
 * `50` is 50%, `20` is 20x — not 18-decimal values.
 *
 * This is an authed, per-pool read: it takes a Bearer `accessToken` from
 * {@link useAuthenticateListing} and the pool's `tokenContractAddress` +
 * `depositChain`. Both string inputs gate the query — until the token **and**
 * the address are non-empty the hook stays idle (`enabled: false`) rather than
 * firing an unauthenticated request, so it can be mounted before sign-in.
 *
 * The config is per-user, so remount or reset the query when the signed-in
 * account changes; the bearer token is deliberately not part of the query key.
 *
 * Enigma-only. A `404` means this read is not deployed on the pool's listing
 * backend yet — the write can be live while the read is not, so treat it as
 * "opinion unknown" rather than a blocking failure. Errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useListingMarketConfig({
 *   accessToken,
 *   tokenContractAddress,
 *   depositChain: market.chainId,
 * });
 *
 * // null until this user has ever configured the pool
 * const mine = data?.userBuybackRatio;
 * const pool = data?.buybackRatio;
 * ```
 */
export function useListingMarketConfig(parameters: UseListingMarketConfigParameters): UseListingMarketConfigReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getListingMarketConfigQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    enabled:
      (parameters.query?.enabled ?? true) &&
      parameters.accessToken.length > 0 &&
      parameters.tokenContractAddress.length > 0,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseListingMarketConfigReturnType;
}
