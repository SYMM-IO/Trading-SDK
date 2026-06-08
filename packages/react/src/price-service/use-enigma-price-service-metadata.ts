"use client";

import {
  getEnigmaPriceServiceMetadataQueryOptions,
  type ConfigParameter,
  type GetEnigmaPriceServiceMetadataOptions,
  type GetEnigmaPriceServiceMetadataReturnType,
} from "@symm-frontier/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useEnigmaPriceServiceMetadata}: symbol address array,
 * chain id, TanStack `query` overrides, plus an optional `config`.
 */
export type UseEnigmaPriceServiceMetadataParameters = GetEnigmaPriceServiceMetadataOptions & ConfigParameter;

/** Return type of {@link useEnigmaPriceServiceMetadata}. */
export type UseEnigmaPriceServiceMetadataReturnType = UseQueryResult<
  GetEnigmaPriceServiceMetadataReturnType,
  SymmioRequestError
>;

/**
 * Fetch metadata from the Enigma price service.
 *
 * @example
 * ```tsx
 * const query = useEnigmaPriceServiceMetadata({ addresses: [tokenAddress] });
 * ```
 */
export function useEnigmaPriceServiceMetadata(
  parameters: UseEnigmaPriceServiceMetadataParameters,
): UseEnigmaPriceServiceMetadataReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getEnigmaPriceServiceMetadataQueryOptions(config, {
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
  }) as UseEnigmaPriceServiceMetadataReturnType;
}
