"use client";

import {
  getSolverBalanceInfoQueryOptions,
  type ConfigParameter,
  type GetSolverBalanceInfoData,
  type GetSolverBalanceInfoOptions,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useSolverBalanceInfo}. */
export type UseSolverBalanceInfoParameters = GetSolverBalanceInfoOptions & ConfigParameter;

/** Return type of {@link useSolverBalanceInfo}. */
export type UseSolverBalanceInfoReturnType = UseQueryResult<GetSolverBalanceInfoData, SymmioRequestError>;

/**
 * Fetch solver-side balance info for an account from the Rasa-only
 * `/get_balance_info` endpoint. Fails with `UNSUPPORTED_BY_SOLVER` when the
 * resolved solver is not a `rasa` solver.
 */
export function useSolverBalanceInfo(parameters: UseSolverBalanceInfoParameters): UseSolverBalanceInfoReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getSolverBalanceInfoQueryOptions(config, {
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
  }) as UseSolverBalanceInfoReturnType;
}
