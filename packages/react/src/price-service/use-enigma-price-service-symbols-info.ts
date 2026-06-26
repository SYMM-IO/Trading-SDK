"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  getEnigmaPriceServiceSymbolsInfoQueryOptions,
  type ConfigParameter,
  type GetEnigmaPriceServiceSymbolsInfoOptions,
  type GetEnigmaPriceServiceSymbolsInfoReturnType,
} from "@theoldvarorg/core";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useEnigmaPriceServiceSymbolsInfo}: chain id, TanStack
 * `query` overrides, plus an optional `config`.
 */
export type UseEnigmaPriceServiceSymbolsInfoParameters = GetEnigmaPriceServiceSymbolsInfoOptions & ConfigParameter;

/** Return type of {@link useEnigmaPriceServiceSymbolsInfo}. */
export type UseEnigmaPriceServiceSymbolsInfoReturnType = UseQueryResult<
  GetEnigmaPriceServiceSymbolsInfoReturnType,
  SymmioRequestError
>;

/**
 * Fetch symbol listings from the Enigma price service.
 *
 * @example
 * ```tsx
 * const query = useEnigmaPriceServiceSymbolsInfo();
 * ```
 */
export function useEnigmaPriceServiceSymbolsInfo(
  parameters: UseEnigmaPriceServiceSymbolsInfoParameters = {},
): UseEnigmaPriceServiceSymbolsInfoReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getEnigmaPriceServiceSymbolsInfoQueryOptions(config, {
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
  }) as UseEnigmaPriceServiceSymbolsInfoReturnType;
}
