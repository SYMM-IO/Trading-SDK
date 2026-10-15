"use client";
import {
  getEnigmaMarketInfoQueryOptions,
  type ConfigParameter,
  type GetEnigmaMarketInfoOptions,
  type GetEnigmaMarketInfoReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
/** Parameters for useEnigmaMarketInfo. */
export type UseEnigmaMarketInfoParameters = GetEnigmaMarketInfoOptions & ConfigParameter;
/** React query result. */
export type UseEnigmaMarketInfoReturnType = UseQueryResult<GetEnigmaMarketInfoReturnType, SymmioRequestError>;
/** Read EnigmaMarketInfo; polling is opt-in through query.refetchInterval. */
export function useEnigmaMarketInfo(parameters: UseEnigmaMarketInfoParameters = {}): UseEnigmaMarketInfoReturnType {
  const config = useSymmioConfig(parameters),
    chainId = useSymmioChainId();
  const options = getEnigmaMarketInfoQueryOptions(config, { ...parameters, chainId: parameters.chainId ?? chainId });
  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  }) as UseEnigmaMarketInfoReturnType;
}
