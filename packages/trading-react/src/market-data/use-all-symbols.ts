"use client";
import {
  getAllSymbolsQueryOptions,
  type ConfigParameter,
  type GetAllSymbolsOptions,
  type GetAllSymbolsReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
/** Parameters for useAllSymbols. */
export type UseAllSymbolsParameters = GetAllSymbolsOptions & ConfigParameter;
/** React query result. */
export type UseAllSymbolsReturnType = UseQueryResult<GetAllSymbolsReturnType, SymmioRequestError>;
/** Read AllSymbols; polling is opt-in through query.refetchInterval. */
export function useAllSymbols(parameters: UseAllSymbolsParameters = {}): UseAllSymbolsReturnType {
  const config = useSymmioConfig(parameters),
    chainId = useSymmioChainId();
  const options = getAllSymbolsQueryOptions(config, { ...parameters, chainId: parameters.chainId ?? chainId });
  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (error) {
        throw normalizeSymmError(error);
      }
    },
  }) as UseAllSymbolsReturnType;
}
