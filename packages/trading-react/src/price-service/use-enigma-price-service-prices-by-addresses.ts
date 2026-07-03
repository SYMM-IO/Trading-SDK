"use client";

import {
  getEnigmaPriceServicePricesByAddressesQueryOptions,
  type ConfigParameter,
  type GetEnigmaPriceServicePricesByAddressesOptions,
  type GetEnigmaPriceServicePricesByAddressesReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useEnigmaPriceServicePricesByAddresses}: symbol addresses,
 * chain id, TanStack `query` overrides, plus an optional `config`.
 */
export type UseEnigmaPriceServicePricesByAddressesParameters = GetEnigmaPriceServicePricesByAddressesOptions &
  ConfigParameter;

/** Return type of {@link useEnigmaPriceServicePricesByAddresses}. */
export type UseEnigmaPriceServicePricesByAddressesReturnType = UseQueryResult<
  GetEnigmaPriceServicePricesByAddressesReturnType,
  SymmioRequestError
>;

/**
 * Fetch mark prices by symbol addresses from the Enigma price service.
 *
 * @example
 * ```tsx
 * const query = useEnigmaPriceServicePricesByAddresses({ addresses: [tokenAddress] });
 * ```
 */
export function useEnigmaPriceServicePricesByAddresses(
  parameters: UseEnigmaPriceServicePricesByAddressesParameters,
): UseEnigmaPriceServicePricesByAddressesReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getEnigmaPriceServicePricesByAddressesQueryOptions(config, {
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
  }) as UseEnigmaPriceServicePricesByAddressesReturnType;
}
