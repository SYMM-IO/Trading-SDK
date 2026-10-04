"use client";

import {
  getSolverInfoQueryOptions,
  type ConfigParameter,
  type GetSolverInfoData,
  type GetSolverInfoOptions,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useSolverInfo}. */
export type UseSolverInfoParameters = GetSolverInfoOptions & ConfigParameter;

/** Return type of {@link useSolverInfo}. */
export type UseSolverInfoReturnType = UseQueryResult<GetSolverInfoData, SymmioRequestError>;

/**
 * Read the solver's static fee configuration via the Enigma-only `/info`
 * endpoint. Fails with `UNSUPPORTED_BY_SOLVER` when the resolved solver is not
 * an `enigma` solver.
 */
export function useSolverInfo(parameters: UseSolverInfoParameters = {}): UseSolverInfoReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getSolverInfoQueryOptions(config, {
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
  }) as UseSolverInfoReturnType;
}
