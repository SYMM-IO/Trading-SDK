"use client";

import {
  getSolverErrorCodesQueryOptions,
  type ConfigParameter,
  type GetSolverErrorCodesOptions,
  type GetSolverErrorCodesReturnType,
} from "@theoldvarorg/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSolverErrorCodes}: the core query options (chain id,
 * TanStack `query` overrides) plus an optional `config`.
 */
export type UseSolverErrorCodesParameters = GetSolverErrorCodesOptions & ConfigParameter;

/** Return type of {@link useSolverErrorCodes}. */
export type UseSolverErrorCodesReturnType = UseQueryResult<GetSolverErrorCodesReturnType, SymmioRequestError>;

/**
 * Fetch the chain solver's error-code → message map (the `/error_codes`
 * endpoint). The map is effectively static, so it is cached with
 * `staleTime: Infinity`; prefer the {@link useSolverErrorMessage} selector to
 * resolve a single code.
 *
 * Returns react-query's full {@link UseQueryResult}. Errors are normalized to
 * {@link SymmioRequestError} so `error.kind` is always a documented value.
 *
 * @example
 * ```tsx
 * const { data: codes } = useSolverErrorCodes();
 * const message = codes?.[2000];
 * ```
 */
export function useSolverErrorCodes(parameters: UseSolverErrorCodesParameters = {}): UseSolverErrorCodesReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getSolverErrorCodesQueryOptions(config, {
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
  }) as UseSolverErrorCodesReturnType;
}
