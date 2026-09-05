"use client";

import {
  getInventoryTvlQueryOptions,
  type ConfigParameter,
  type GetInventoryTvlOptions,
  type GetInventoryTvlReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useInventoryTvl}: the core query options plus an optional `config`. */
export type UseInventoryTvlParameters = GetInventoryTvlOptions & ConfigParameter;

/** Return type of {@link useInventoryTvl}: aggregate TVL as an 18-decimal `bigint`. */
export type UseInventoryTvlReturnType = UseQueryResult<GetInventoryTvlReturnType, SymmioRequestError>;

/**
 * Read the system-wide custodial TVL from the connected chain's inventory
 * service — the headline TVL figure on a pools page.
 *
 * Returned as a `bigint` at `INVENTORY_VALUE_DECIMALS` (18); format with
 * `formatUnits`. This is **not** the sum of the pool catalogue's per-pool `tvl`
 * values — the catalogue covers listed markets, this covers the whole custodial
 * system. Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data: tvl } = useInventoryTvl();
 * ```
 */
export function useInventoryTvl(parameters: UseInventoryTvlParameters = {}): UseInventoryTvlReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getInventoryTvlQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseInventoryTvlReturnType;
}
