"use client";

import {
  getWeeklyListingLimitQueryOptions,
  type ConfigParameter,
  type GetWeeklyListingLimitOptions,
  type WeeklyListingLimit,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useWeeklyListingLimit}: the core query options plus an optional `config`. */
export type UseWeeklyListingLimitParameters = GetWeeklyListingLimitOptions & ConfigParameter;

/** Return type of {@link useWeeklyListingLimit}: the protocol's global weekly listing cap. */
export type UseWeeklyListingLimitReturnType = UseQueryResult<WeeklyListingLimit, SymmioRequestError>;

/**
 * Read the protocol's **global** remaining new-market listings for the current
 * rolling weekly window — the cap a create-pool flow must check before
 * {@link useAddMarket}.
 *
 * The service caps how many pools may be created across the whole protocol each
 * week, not per user. Gate the Create button on `data.remaining <= 0`: when the
 * cap is spent no more pools can be listed until `data.resetAt` (a Unix
 * timestamp). This is a **public** read — no token, resolved from the config, so
 * it can be mounted unconditionally. Enigma-only; errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const weekly = useWeeklyListingLimit();
 * const limitReached = weekly.data ? weekly.data.remaining <= 0 : false;
 * // disable the create button while `limitReached`.
 * ```
 */
export function useWeeklyListingLimit(
  parameters: UseWeeklyListingLimitParameters = {},
): UseWeeklyListingLimitReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getWeeklyListingLimitQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    enabled: parameters.query?.enabled ?? true,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseWeeklyListingLimitReturnType;
}
