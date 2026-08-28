"use client";

import {
  getSymbolsQueryOptions,
  type ConfigParameter,
  type GetSymbolsOptions,
  type GetSymbolsReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useSymbols}: the core query options plus an optional
 * `config`.
 */
export type UseSymbolsParameters = GetSymbolsOptions & ConfigParameter;

/** Return type of {@link useSymbols}. */
export type UseSymbolsReturnType = UseQueryResult<GetSymbolsReturnType, SymmioRequestError>;

/**
 * Read the tradable symbol catalogue from the active chain's solver in one call.
 * Surfaces a normalized row per symbol — id, name, precisions, leverage, fees,
 * and per-side trading state — filtered and paged by the given parameters.
 *
 * Does not poll by default; pass `query.refetchInterval` to opt into polling.
 *
 * @example
 * ```tsx
 * const { data } = useSymbols({ search: "BTC" });
 * const btc = data?.find((s) => s.name === "BTCUSDT");
 * ```
 */
export function useSymbols(parameters: UseSymbolsParameters = {}): UseSymbolsReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getSymbolsQueryOptions(config, {
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
  }) as UseSymbolsReturnType;
}
