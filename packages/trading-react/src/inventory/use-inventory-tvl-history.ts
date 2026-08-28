"use client";

import {
  getInventoryTvlHistoryQueryOptions,
  type ConfigParameter,
  type GetInventoryTvlHistoryOptions,
  type GetInventoryTvlHistoryReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useInventoryTvlHistory}: the core query options plus an optional `config`. */
export type UseInventoryTvlHistoryParameters = GetInventoryTvlHistoryOptions & ConfigParameter;

/** Return type of {@link useInventoryTvlHistory}: one TVL point per snapshot. */
export type UseInventoryTvlHistoryReturnType = UseQueryResult<GetInventoryTvlHistoryReturnType, SymmioRequestError>;

/**
 * Read one market's custodial TVL over time from the connected chain's inventory
 * service — the series behind a pool page's TVL chart.
 *
 * The per-market twin of {@link useInventoryTvl}, which reports the whole
 * custodial system as a single figure. Each point's `tvl` is a `bigint` at
 * `INVENTORY_VALUE_DECIMALS` (18) and `timestamp` is unix **seconds**.
 *
 * `symbolAddress` gates the query: until it is a non-empty string the hook stays
 * idle (`enabled: false`), so it can be mounted before a pool is picked. The
 * endpoint is not deployed on every environment — treat an error as "no chart",
 * not a broken page. Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: history } = useInventoryTvlHistory({ symbolAddress: pool.contractAddress });
 * ```
 */
export function useInventoryTvlHistory(parameters: UseInventoryTvlHistoryParameters): UseInventoryTvlHistoryReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getInventoryTvlHistoryQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    enabled: (parameters.query?.enabled ?? true) && parameters.symbolAddress.length > 0,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseInventoryTvlHistoryReturnType;
}
