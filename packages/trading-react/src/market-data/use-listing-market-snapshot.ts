"use client";
import {
  getListingMarketSnapshotQueryOptions,
  type ConfigParameter,
  type GetListingMarketSnapshotOptions,
  type GetListingMarketSnapshotReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
/** Parameters for useListingMarketSnapshot. */
export type UseListingMarketSnapshotParameters = GetListingMarketSnapshotOptions & ConfigParameter;
/** React query result. */
export type UseListingMarketSnapshotReturnType = UseQueryResult<GetListingMarketSnapshotReturnType, SymmioRequestError>;
/** Read ListingMarketSnapshot; polling is opt-in through query.refetchInterval. */
export function useListingMarketSnapshot(
  parameters: UseListingMarketSnapshotParameters = {},
): UseListingMarketSnapshotReturnType {
  const config = useSymmioConfig(parameters),
    chainId = useSymmioChainId();
  const options = getListingMarketSnapshotQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
  });
  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  }) as UseListingMarketSnapshotReturnType;
}
