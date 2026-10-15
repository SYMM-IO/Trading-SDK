"use client";
import {
  getTokenMarketDataQueryOptions,
  type ConfigParameter,
  type GetTokenMarketDataOptions,
  type GetTokenMarketDataReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
/** Parameters for useTokenMarketData. */
export type UseTokenMarketDataParameters = GetTokenMarketDataOptions & ConfigParameter;
/** React query result. */
export type UseTokenMarketDataReturnType = UseQueryResult<GetTokenMarketDataReturnType, SymmioRequestError>;
/** Read TokenMarketData; polling is opt-in through query.refetchInterval. */
export function useTokenMarketData(parameters: UseTokenMarketDataParameters): UseTokenMarketDataReturnType {
  const config = useSymmioConfig(parameters),
    chainId = useSymmioChainId();
  const options = getTokenMarketDataQueryOptions(config, { ...parameters, chainId: parameters.chainId ?? chainId });
  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  }) as UseTokenMarketDataReturnType;
}
