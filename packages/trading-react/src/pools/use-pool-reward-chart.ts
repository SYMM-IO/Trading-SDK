"use client";

import {
  getPoolRewardChartQueryOptions,
  type ConfigParameter,
  type GetPoolRewardChartOptions,
  type GetPoolRewardChartReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link usePoolRewardChart}: the core query options plus an optional `config`. */
export type UsePoolRewardChartParameters = GetPoolRewardChartOptions & ConfigParameter;

/** Return type of {@link usePoolRewardChart}: one point per reward day. */
export type UsePoolRewardChartReturnType = UseQueryResult<GetPoolRewardChartReturnType, SymmioRequestError>;

/**
 * Read a pool's daily LP-reward series — the public series behind a pool page's
 * rewards chart.
 *
 * Public: no bearer token. A pool is addressed by the pair
 * `(marketAddress, marketChainId)`, matching a `ListingMarket`'s
 * `contractAddress` and `chainId`; `marketChainId` is the chain the pool's token
 * lives on, **not** the SYMMIO chain the market trades on.
 *
 * `marketAddress` gates the query, so the hook can be mounted before a pool is
 * picked. Each point's `reward` is a `bigint` at `LISTING_VALUE_DECIMALS` (18)
 * and is money — the descaled figure is USD, not a percentage. A pool with no
 * snapshots resolves to an empty array rather than erroring. Errors are
 * normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: rewards } = usePoolRewardChart({
 *   marketAddress: pool.contractAddress,
 *   marketChainId: pool.chainId,
 * });
 * ```
 */
export function usePoolRewardChart(parameters: UsePoolRewardChartParameters): UsePoolRewardChartReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getPoolRewardChartQueryOptions(config, {
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
  }) as UsePoolRewardChartReturnType;
}
