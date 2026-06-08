"use client";

import {
  getEnigmaPriceServicePricesQueryOptions,
  type ConfigParameter,
  type GetEnigmaPriceServicePricesOptions,
  type GetEnigmaPriceServicePricesReturnType,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useEnigmaPriceServicePrices}: symbol addresses, chain
 * id, TanStack `query` overrides, plus an optional `config`.
 */
export type UseEnigmaPriceServicePricesParameters = GetEnigmaPriceServicePricesOptions & ConfigParameter;

/** Return type of {@link useEnigmaPriceServicePrices}. */
export type UseEnigmaPriceServicePricesReturnType = UseQueryResult<
  GetEnigmaPriceServicePricesReturnType,
  SymmioRequestError
>;

/**
 * Fetch mark prices from the Enigma price service.
 *
 * @example
 * ```tsx
 * const query = useEnigmaPriceServicePrices({ addresses: [tokenAddress] });
 * ```
 */
export function useEnigmaPriceServicePrices(
  parameters: UseEnigmaPriceServicePricesParameters,
): UseEnigmaPriceServicePricesReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getEnigmaPriceServicePricesQueryOptions(config, {
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
  }) as UseEnigmaPriceServicePricesReturnType;
}
