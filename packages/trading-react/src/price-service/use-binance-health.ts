"use client";

import { getBinanceHealthQueryOptions, type ConfigParameter, type GetBinanceHealthOptions } from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useBinanceHealth}. */
export type UseBinanceHealthParameters = GetBinanceHealthOptions & ConfigParameter;

/** Value returned by {@link useBinanceHealth}. */
export type UseBinanceHealthReturnType = UseQueryResult<
  import("@symmio/trading-core").GetBinanceHealthData,
  SymmioRequestError
>;

/**
 * Probe whether Binance is reachable from this client.
 *
 * Resolves `false` rather than erroring when the endpoint cannot be reached, so
 * this distinguishes "Binance is blocked/unreachable here" — the common case in
 * a restricted region — from "this market has no price".
 */
export function useBinanceHealth(parameters: UseBinanceHealthParameters = {}): UseBinanceHealthReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getBinanceHealthQueryOptions(config, { ...parameters, chainId: parameters.chainId ?? chainId });

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseBinanceHealthReturnType;
}
