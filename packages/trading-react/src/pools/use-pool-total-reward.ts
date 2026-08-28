"use client";

import {
  getPoolTotalRewardQueryOptions,
  type ConfigParameter,
  type GetPoolTotalRewardOptions,
  type GetPoolTotalRewardReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link usePoolTotalReward}: the core query options plus an optional `config`. */
export type UsePoolTotalRewardParameters = GetPoolTotalRewardOptions & ConfigParameter;

/** Return type of {@link usePoolTotalReward}: aggregate reward as an 18-decimal `bigint`. */
export type UsePoolTotalRewardReturnType = UseQueryResult<GetPoolTotalRewardReturnType, SymmioRequestError>;

/**
 * Read a pool's aggregate LP reward over the last `days` — the headline figure
 * above a pool's rewards chart.
 *
 * Public: no bearer token. `days` is capped at **30** by the service; a larger
 * window is rejected with a `422`. The result is money at
 * `LISTING_VALUE_DECIMALS` (18) — the descaled figure is USD. `marketAddress`
 * gates the query. Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: reward30d } = usePoolTotalReward({
 *   marketAddress: pool.contractAddress,
 *   marketChainId: pool.chainId,
 *   days: 30,
 * });
 * ```
 */
export function usePoolTotalReward(parameters: UsePoolTotalRewardParameters): UsePoolTotalRewardReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getPoolTotalRewardQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    enabled: (parameters.query?.enabled ?? true) && parameters.marketAddress.length > 0,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UsePoolTotalRewardReturnType;
}
