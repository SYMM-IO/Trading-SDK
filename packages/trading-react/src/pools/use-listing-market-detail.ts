"use client";

import {
  getListingMarketDetailQueryOptions,
  type ConfigParameter,
  type GetListingMarketDetailOptions,
  type GetListingMarketDetailReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useListingMarketDetail}: the core query options plus an optional `config`. */
export type UseListingMarketDetailParameters = GetListingMarketDetailOptions & ConfigParameter;

/** Return type of {@link useListingMarketDetail}: one pool's public detail. */
export type UseListingMarketDetailReturnType = UseQueryResult<GetListingMarketDetailReturnType, SymmioRequestError>;

/**
 * Read one pool's public detail — its TVL, APY and reward windows, solver
 * revenue, pool balances, active LPs, age, and the inventory position behind it.
 *
 * This is the read a pool page is built on: the same response feeds the stats
 * cards and, via `toPoolPositions`, the positions table — one request, not two.
 *
 * A pool is addressed by its token **and** deposit chain, since the same token
 * can be listed from more than one. Public: no access token needed. Errors are
 * normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useListingMarketDetail({
 *   tokenContractAddress,
 *   depositChain: ListingDepositChainId.BASE,
 * });
 * const rows = data ? toPoolPositions(data) : [];
 * ```
 */
export function useListingMarketDetail(parameters: UseListingMarketDetailParameters): UseListingMarketDetailReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getListingMarketDetailQueryOptions(config, {
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
  }) as UseListingMarketDetailReturnType;
}
