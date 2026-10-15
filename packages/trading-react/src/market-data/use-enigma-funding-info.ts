"use client";
import {
  getEnigmaFundingInfoQueryOptions,
  type ConfigParameter,
  type GetEnigmaFundingInfoOptions,
  type GetEnigmaFundingInfoReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
/** Parameters for useEnigmaFundingInfo. */
export type UseEnigmaFundingInfoParameters = GetEnigmaFundingInfoOptions & ConfigParameter;
/** React query result. */
export type UseEnigmaFundingInfoReturnType = UseQueryResult<GetEnigmaFundingInfoReturnType, SymmioRequestError>;
/** Read EnigmaFundingInfo; polling is opt-in through query.refetchInterval. */
export function useEnigmaFundingInfo(parameters: UseEnigmaFundingInfoParameters = {}): UseEnigmaFundingInfoReturnType {
  const config = useSymmioConfig(parameters),
    chainId = useSymmioChainId();
  const options = getEnigmaFundingInfoQueryOptions(config, { ...parameters, chainId: parameters.chainId ?? chainId });
  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  }) as UseEnigmaFundingInfoReturnType;
}
