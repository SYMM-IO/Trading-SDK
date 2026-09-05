"use client";

import {
  getErrorMessageQueryOptions,
  type ConfigParameter,
  type GetErrorMessageData,
  type GetErrorMessageOptions,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useErrorMessage}. */
export type UseErrorMessageParameters = GetErrorMessageOptions & ConfigParameter;

/** Return type of {@link useErrorMessage}. */
export type UseErrorMessageReturnType = UseQueryResult<GetErrorMessageData, SymmioRequestError>;

/**
 * Look up a single solver error code's message from the Rasa-only
 * `/error_codes/{error_code}` endpoint. Fails with `UNSUPPORTED_BY_SOLVER`
 * when the resolved solver is not a `rasa` solver.
 */
export function useErrorMessage(parameters: UseErrorMessageParameters): UseErrorMessageReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getErrorMessageQueryOptions(config, {
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
  }) as UseErrorMessageReturnType;
}
