"use client";

import {
  searchSolverNotificationsQueryOptions,
  type ConfigParameter,
  type SearchSolverNotificationsData,
  type SearchSolverNotificationsOptions,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useSearchSolverNotifications}. */
export type UseSearchSolverNotificationsParameters = SearchSolverNotificationsOptions & ConfigParameter;

/** Return type of {@link useSearchSolverNotifications}. */
export type UseSearchSolverNotificationsReturnType = UseQueryResult<SearchSolverNotificationsData, SymmioRequestError>;

/**
 * Search the solver's own notification log (paged) via the Rasa-only
 * `POST /notifications/{start}/{size}` endpoint. Fails with
 * `UNSUPPORTED_BY_SOLVER` when the resolved solver is not a `rasa` solver.
 */
export function useSearchSolverNotifications(
  parameters: UseSearchSolverNotificationsParameters,
): UseSearchSolverNotificationsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = searchSolverNotificationsQueryOptions(config, {
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
  }) as UseSearchSolverNotificationsReturnType;
}
