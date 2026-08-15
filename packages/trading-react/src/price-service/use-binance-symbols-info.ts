"use client";

import {
  getBinanceSymbolsInfoQueryOptions,
  type ConfigParameter,
  type GetBinanceSymbolsInfoOptions,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useBinanceSymbolsInfo}. */
export type UseBinanceSymbolsInfoParameters = GetBinanceSymbolsInfoOptions & ConfigParameter;

/** Value returned by {@link useBinanceSymbolsInfo}. */
export type UseBinanceSymbolsInfoReturnType = UseQueryResult<
  import("@symmio/trading-core").GetBinanceSymbolsInfoData,
  SymmioRequestError
>;

/**
 * Read Binance's own contract listing (status, price/quantity precision).
 *
 * Reference data only — `useMarkets` remains the authority on what is tradable
 * on SYMMIO. Useful to check whether a market has a Binance price source at all.
 *
 * The payload is ~1 MB, so the underlying query defaults to a one-hour
 * `staleTime`. Do not poll it.
 */
export function useBinanceSymbolsInfo(
  parameters: UseBinanceSymbolsInfoParameters = {},
): UseBinanceSymbolsInfoReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getBinanceSymbolsInfoQueryOptions(config, { ...parameters, chainId: parameters.chainId ?? chainId });

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseBinanceSymbolsInfoReturnType;
}
