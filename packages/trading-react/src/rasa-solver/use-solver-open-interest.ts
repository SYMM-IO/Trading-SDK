"use client";

import {
  getSolverOpenInterestQueryOptions,
  type ConfigParameter,
  type GetSolverOpenInterestData,
  type GetSolverOpenInterestOptions,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useSolverOpenInterest}. */
export type UseSolverOpenInterestParameters = GetSolverOpenInterestOptions & ConfigParameter;

/** Return type of {@link useSolverOpenInterest}. */
export type UseSolverOpenInterestReturnType = UseQueryResult<GetSolverOpenInterestData, SymmioRequestError>;

/**
 * Fetch the solver's global open interest (`total_cap` / `used`) from the
 * Rasa-only `/open-interest` endpoint. Fails with `UNSUPPORTED_BY_SOLVER` when
 * the resolved solver is not a `rasa` solver.
 */
export function useSolverOpenInterest(
  parameters: UseSolverOpenInterestParameters = {},
): UseSolverOpenInterestReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getSolverOpenInterestQueryOptions(config, {
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
  }) as UseSolverOpenInterestReturnType;
}
