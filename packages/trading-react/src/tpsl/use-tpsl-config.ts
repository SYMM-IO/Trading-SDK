"use client";

import {
  getTpSlConfigQueryOptions,
  type ConfigParameter,
  type GetTpSlConfigOptions,
  type GetTpSlConfigReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useTpSlConfig}. */
export type UseTpSlConfigParameters = GetTpSlConfigOptions & ConfigParameter;

/** Return type of {@link useTpSlConfig}. */
export type UseTpSlConfigReturnType = UseQueryResult<GetTpSlConfigReturnType, SymmioRequestError>;

/**
 * Read the TP/SL handler's `/configs/` rules — `minPriceDistancePercent` and
 * `minProfitStopLossSpreadPercent`. Pair with `validateTpSl()` to live-check
 * user input.
 */
export function useTpSlConfig(parameters: UseTpSlConfigParameters = {}): UseTpSlConfigReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getTpSlConfigQueryOptions(config, {
    ...parameters,
    chainId: parameters.chainId ?? chainId,
    query: { staleTime: 60_000, ...parameters.query },
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
  }) as UseTpSlConfigReturnType;
}
