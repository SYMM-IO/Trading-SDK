"use client";

import {
  getTpSlSigningSpecQueryOptions,
  type ConfigParameter,
  type GetTpSlSigningSpecOptions,
  type GetTpSlSigningSpecReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useTpSlSigningSpec}. */
export type UseTpSlSigningSpecParameters = GetTpSlSigningSpecOptions & ConfigParameter;

/** Return type of {@link useTpSlSigningSpec}. */
export type UseTpSlSigningSpecReturnType = UseQueryResult<GetTpSlSigningSpecReturnType, SymmioRequestError>;

/**
 * Read the handler's EIP-712 signing spec (`<base>/signing-spec`). Cached
 * indefinitely — the spec is stable per deployment.
 */
export function useTpSlSigningSpec(parameters: UseTpSlSigningSpecParameters = {}): UseTpSlSigningSpecReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getTpSlSigningSpecQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
    query: { staleTime: Infinity, ...parameters.query },
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
  }) as UseTpSlSigningSpecReturnType;
}
