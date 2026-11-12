"use client";

import {
  getSolverInfoQueryOptions,
  type ConfigParameter,
  type GetSolverInfoData,
  type GetSolverInfoOptions,
  type TimelockApprovalCapability,
} from "@symmio/trading-core";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import {
  rememberTimelockCapability,
  timelockCapabilityKey,
  useKnownTimelockCapability,
} from "./timelock-capability-cache";

/** Parameters for {@link useSolverInfo}. */
export type UseSolverInfoParameters = GetSolverInfoOptions & ConfigParameter;

/** Return type of {@link useSolverInfo}. */
export type UseSolverInfoReturnType = UseQueryResult<GetSolverInfoData, SymmioRequestError> & {
  /** Last validated positive timelock capability observed for this deployment in this QueryClient. */
  knownTimelockApproval?: TimelockApprovalCapability;
};

/**
 * Read the solver's static fee configuration via the Enigma-only `/info`
 * endpoint. Fails with `UNSUPPORTED_BY_SOLVER` when the resolved solver is not
 * an `enigma` solver.
 */
export function useSolverInfo(parameters: UseSolverInfoParameters = {}): UseSolverInfoReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const resolvedChainId = parameters.chainId ?? chainId;
  const queryClient = useQueryClient();
  const key = useMemo(() => {
    try {
      return timelockCapabilityKey(config, resolvedChainId, parameters.solverId);
    } catch {
      return undefined;
    }
  }, [config, resolvedChainId, parameters.solverId]);
  const known = useKnownTimelockCapability(config, resolvedChainId, parameters.solverId);
  const options = getSolverInfoQueryOptions(config, {
    ...parameters,
    chainId: resolvedChainId,
  });

  const result = useQuery({
    ...options,
    queryFn: async () => {
      try {
        const data = await options.queryFn();
        if (key) rememberTimelockCapability(queryClient, key, data.timelockApproval);
        return data;
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseQueryResult<GetSolverInfoData, SymmioRequestError>;
  useEffect(() => {
    if (key && !result.isPlaceholderData && result.data?.timelockApproval && !known)
      rememberTimelockCapability(queryClient, key, result.data.timelockApproval);
  }, [queryClient, key, known, result.isPlaceholderData, result.data?.timelockApproval]);
  return {
    ...result,
    knownTimelockApproval: known ?? (result.isPlaceholderData ? undefined : result.data?.timelockApproval),
  };
}
