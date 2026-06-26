"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  getEnigmaPriceServicePricesByNamesQueryOptions,
  type ConfigParameter,
  type GetEnigmaPriceServicePricesByNamesOptions,
  type GetEnigmaPriceServicePricesByNamesReturnType,
} from "@theoldvarorg/core";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useEnigmaPriceServicePricesByNames}: market names, chain
 * id, TanStack `query` overrides, plus an optional `config`.
 */
export type UseEnigmaPriceServicePricesByNamesParameters = GetEnigmaPriceServicePricesByNamesOptions & ConfigParameter;

/** Return type of {@link useEnigmaPriceServicePricesByNames}. */
export type UseEnigmaPriceServicePricesByNamesReturnType = UseQueryResult<
  GetEnigmaPriceServicePricesByNamesReturnType,
  SymmioRequestError
>;

/**
 * Fetch mark prices by market names from the Enigma price service.
 *
 * @example
 * ```tsx
 * const query = useEnigmaPriceServicePricesByNames({ names: ["BTCUSDT"] });
 * ```
 */
export function useEnigmaPriceServicePricesByNames(
  parameters: UseEnigmaPriceServicePricesByNamesParameters,
): UseEnigmaPriceServicePricesByNamesReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getEnigmaPriceServicePricesByNamesQueryOptions(config, {
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
  }) as UseEnigmaPriceServicePricesByNamesReturnType;
}
