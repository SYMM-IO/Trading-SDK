"use client";

import {
  searchPositionStatesQueryOptions,
  type ConfigParameter,
  type SearchPositionStatesData,
  type SearchPositionStatesOptions,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useSearchPositionStates}. */
export type UseSearchPositionStatesParameters = SearchPositionStatesOptions & ConfigParameter;

/** Return type of {@link useSearchPositionStates}. */
export type UseSearchPositionStatesReturnType = UseQueryResult<SearchPositionStatesData, SymmioRequestError>;

/**
 * Search the solver's position-state records (paged) via the Rasa-only
 * `POST /position-state/{start}/{size}` endpoint. Fails with
 * `UNSUPPORTED_BY_SOLVER` when the resolved solver is not a `rasa` solver.
 */
export function useSearchPositionStates(
  parameters: UseSearchPositionStatesParameters,
): UseSearchPositionStatesReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = searchPositionStatesQueryOptions(config, {
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
  }) as UseSearchPositionStatesReturnType;
}
