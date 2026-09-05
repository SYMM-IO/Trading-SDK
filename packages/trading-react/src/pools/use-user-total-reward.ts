"use client";

import {
  getUserTotalRewardQueryOptions,
  type ConfigParameter,
  type GetUserTotalRewardOptions,
  type GetUserTotalRewardReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useUserTotalReward}: the core query options plus an optional `config`. */
export type UseUserTotalRewardParameters = GetUserTotalRewardOptions & ConfigParameter;

/** Return type of {@link useUserTotalReward}: aggregate reward as an 18-decimal `bigint`. */
export type UseUserTotalRewardReturnType = UseQueryResult<GetUserTotalRewardReturnType, SymmioRequestError>;

/**
 * Read the signed-in user's aggregate LP reward over the last `days`, across
 * **every** market they earn in.
 *
 * Built from earned daily snapshots, so claiming does not reduce it — it is
 * lifetime-earned within the window, not an unclaimed balance; use
 * {@link useUserProfit} for the claimable figure. `days` is capped at **30** by
 * the service. Both the `accessToken` and `userAddress` gate the query, so the
 * hook can be mounted before sign-in. Errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { address } = useAccount();
 * const { data: earned30d } = useUserTotalReward({
 *   accessToken,
 *   userAddress: address ?? "",
 *   days: 30,
 * });
 * ```
 */
export function useUserTotalReward(parameters: UseUserTotalRewardParameters): UseUserTotalRewardReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getUserTotalRewardQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    enabled:
      (parameters.query?.enabled ?? true) && parameters.accessToken.length > 0 && parameters.userAddress.length > 0,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseUserTotalRewardReturnType;
}
