"use client";

import {
  getSolverReadinessQueryOptions,
  type ConfigParameter,
  type GetSolverReadinessData,
  type GetSolverReadinessOptions,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useSolverReadiness}. */
export type UseSolverReadinessParameters = GetSolverReadinessOptions & ConfigParameter;

/** Return type of {@link useSolverReadiness}. */
export type UseSolverReadinessReturnType = UseQueryResult<GetSolverReadinessData, SymmioRequestError>;

/**
 * Check solver availability via the Rasa-only `/readyz` endpoint. Fails with
 * `UNSUPPORTED_BY_SOLVER` when the resolved solver is not a `rasa` solver.
 */
export function useSolverReadiness(parameters: UseSolverReadinessParameters = {}): UseSolverReadinessReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getSolverReadinessQueryOptions(config, {
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
  }) as UseSolverReadinessReturnType;
}
