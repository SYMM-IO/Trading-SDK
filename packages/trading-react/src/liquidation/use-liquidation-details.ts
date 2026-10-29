"use client";

import {
  getLiquidationDetailsQueryOptions,
  type ConfigParameter,
  type GetLiquidationDetailsOptions,
  type GetLiquidationDetailsReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useLiquidationDetails}: the core query options (filters, paging,
 * sort, chain id, TanStack `query` overrides) plus an optional `config`.
 */
export type UseLiquidationDetailsParameters = GetLiquidationDetailsOptions & ConfigParameter;

/** Return type of {@link useLiquidationDetails}: one page of rows plus `hasMore`. */
export type UseLiquidationDetailsReturnType = UseQueryResult<GetLiquidationDetailsReturnType, SymmioRequestError>;

/**
 * Read `LiquidationDetail` entities — one per PartyA liquidation — from the
 * analytics subgraph (`getLiquidationDetails`). Every filter is optional and
 * applied only when passed.
 *
 * `chainId` defaults to the connected chain. Errors normalized to
 * {@link SymmioRequestError}.
 *
 * @param parameters - Filters, paging, sort, optional chain id and config.
 * @returns The TanStack query result.
 *
 * @example
 * ```tsx
 * const { data } = useLiquidationDetails({ source: diamond, partyAs: [virtualAccount] });
 * ```
 */
export function useLiquidationDetails(
  parameters: UseLiquidationDetailsParameters = {},
): UseLiquidationDetailsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getLiquidationDetailsQueryOptions(config, {
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
  }) as UseLiquidationDetailsReturnType;
}
