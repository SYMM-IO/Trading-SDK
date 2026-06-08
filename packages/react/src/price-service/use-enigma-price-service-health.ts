"use client";

import {
  getEnigmaPriceServiceHealthQueryOptions,
  type ConfigParameter,
  type GetEnigmaPriceServiceHealthOptions,
  type GetEnigmaPriceServiceHealthReturnType,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useEnigmaPriceServiceHealth}: chain id, TanStack
 * `query` overrides, plus an optional `config`.
 */
export type UseEnigmaPriceServiceHealthParameters = GetEnigmaPriceServiceHealthOptions & ConfigParameter;

/** Return type of {@link useEnigmaPriceServiceHealth}. */
export type UseEnigmaPriceServiceHealthReturnType = UseQueryResult<
  GetEnigmaPriceServiceHealthReturnType,
  SymmioRequestError
>;

/**
 * Read the Enigma price-service health endpoint.
 *
 * @example
 * ```tsx
 * const query = useEnigmaPriceServiceHealth();
 * ```
 */
export function useEnigmaPriceServiceHealth(
  parameters: UseEnigmaPriceServiceHealthParameters = {},
): UseEnigmaPriceServiceHealthReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getEnigmaPriceServiceHealthQueryOptions(config, {
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
  }) as UseEnigmaPriceServiceHealthReturnType;
}
