"use client";

import {
  getFundingIndexCheckpointsQueryOptions,
  type ConfigParameter,
  type GetFundingIndexCheckpointsOptions,
  type GetFundingIndexCheckpointsReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useFundingIndexCheckpoints}: the core query options (filters, paging,
 * sort, chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseFundingIndexCheckpointsParameters = GetFundingIndexCheckpointsOptions & ConfigParameter;

/** Return type of {@link useFundingIndexCheckpoints}: one page of rows plus `hasMore`. */
export type UseFundingIndexCheckpointsReturnType = UseQueryResult<
  GetFundingIndexCheckpointsReturnType,
  SymmioRequestError
>;

/**
 * Read `FundingIndexCheckpoint` entities — the funding-rate index of a market
 * and PartyB over time — from the analytics subgraph
 * (`getFundingIndexCheckpoints`). Every filter is optional and applied only
 * when passed.
 *
 * `chainId` defaults to the connected chain. Errors normalized to
 * {@link SymmioRequestError}.
 *
 * @param parameters - Filters, paging, sort, optional chain id and config.
 * @returns The TanStack query result.
 *
 * @example
 * ```tsx
 * const { data } = useFundingIndexCheckpoints({ marketIds: [42], partyBs: [solver], startTime: openedAt });
 * ```
 */
export function useFundingIndexCheckpoints(
  parameters: UseFundingIndexCheckpointsParameters = {},
): UseFundingIndexCheckpointsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getFundingIndexCheckpointsQueryOptions(config, {
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
  }) as UseFundingIndexCheckpointsReturnType;
}
