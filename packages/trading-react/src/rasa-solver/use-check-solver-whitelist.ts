"use client";

import {
  checkSolverWhitelistQueryOptions,
  type CheckSolverWhitelistData,
  type CheckSolverWhitelistOptions,
  type ConfigParameter,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useCheckSolverWhitelist}. */
export type UseCheckSolverWhitelistParameters = CheckSolverWhitelistOptions & ConfigParameter;

/** Return type of {@link useCheckSolverWhitelist}. */
export type UseCheckSolverWhitelistReturnType = UseQueryResult<CheckSolverWhitelistData, SymmioRequestError>;

/**
 * Check whether an address is on the solver's whitelist via the Rasa-only
 * `/check_in-whitelist` endpoint. Fails with `UNSUPPORTED_BY_SOLVER` when the
 * resolved solver is not a `rasa` solver.
 */
export function useCheckSolverWhitelist(
  parameters: UseCheckSolverWhitelistParameters,
): UseCheckSolverWhitelistReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = checkSolverWhitelistQueryOptions(config, {
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
  }) as UseCheckSolverWhitelistReturnType;
}
