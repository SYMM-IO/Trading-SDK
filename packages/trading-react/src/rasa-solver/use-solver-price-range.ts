"use client";

import {
  getSolverPriceRangeQueryOptions,
  type ConfigParameter,
  type GetSolverPriceRangeData,
  type GetSolverPriceRangeOptions,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useSolverPriceRange}. */
export type UseSolverPriceRangeParameters = GetSolverPriceRangeOptions & ConfigParameter;

/** Return type of {@link useSolverPriceRange}. */
export type UseSolverPriceRangeReturnType = UseQueryResult<GetSolverPriceRangeData, SymmioRequestError>;

/**
 * Fetch a symbol's acceptable price range from the Rasa-only
 * `/price-range/{symbol}` endpoint. Fails with `UNSUPPORTED_BY_SOLVER` when
 * the resolved solver is not a `rasa` solver.
 */
export function useSolverPriceRange(parameters: UseSolverPriceRangeParameters): UseSolverPriceRangeReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getSolverPriceRangeQueryOptions(config, {
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
  }) as UseSolverPriceRangeReturnType;
}
