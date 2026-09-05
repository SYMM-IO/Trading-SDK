"use client";

import {
  getListingMarketsQueryOptions,
  type ConfigParameter,
  type GetListingMarketsOptions,
  type GetListingMarketsReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useListingMarkets}: the core query options plus an optional `config`. */
export type UseListingMarketsParameters = GetListingMarketsOptions & ConfigParameter;

/** Return type of {@link useListingMarkets}: one page of the listing catalog. */
export type UseListingMarketsReturnType = UseQueryResult<GetListingMarketsReturnType, SymmioRequestError>;

/**
 * Read a page of the permissionless-listing market catalog — the data behind a
 * pools list.
 *
 * Search, filtering, sorting, and pagination are all server-side: change a
 * parameter and the hook refetches under a new query key rather than filtering
 * an already-fetched page in the client. Pass
 * `marketStatus: ListingMarketStatus.LISTED` to see only tradable markets.
 *
 * Every money and rate field on a row is a `bigint` at `LISTING_VALUE_DECIMALS`
 * (18); `null` means the service reported no value, not zero. Errors are
 * normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data, isPending } = useListingMarkets({
 *   marketStatus: ListingMarketStatus.LISTED,
 *   sortBy: "tvl",
 *   limit: 25,
 *   offset: page * 25,
 * });
 * ```
 */
export function useListingMarkets(parameters: UseListingMarketsParameters = {}): UseListingMarketsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getListingMarketsQueryOptions(config, {
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
  }) as UseListingMarketsReturnType;
}
