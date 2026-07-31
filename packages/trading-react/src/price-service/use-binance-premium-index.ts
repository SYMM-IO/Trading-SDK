"use client";

import {
  getBinancePremiumIndexQueryOptions,
  type ConfigParameter,
  type GetBinancePremiumIndexOptions,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useBinancePremiumIndex}. */
export type UseBinancePremiumIndexParameters = GetBinancePremiumIndexOptions & ConfigParameter;

/** Value returned by {@link useBinancePremiumIndex}. */
export type UseBinancePremiumIndexReturnType = UseQueryResult<
  import("@symmio/trading-core").GetBinancePremiumIndexData,
  SymmioRequestError
>;

/**
 * Read Binance mark, index and funding data for the resolved solver's markets.
 *
 * The provider-specific twin of `useMarkPrices`. Passing exactly one name takes
 * Binance's single-symbol request form (weight 1) instead of the all-symbols
 * form (weight 10).
 *
 * Throws `UNSUPPORTED_BY_PRICE_SERVICE` when the target solver is not priced by
 * Binance, so gate it on a Binance-backed solver.
 *
 * @example
 * ```tsx
 * const { data } = useBinancePremiumIndex({ solverId: "rasa", names: ["BTCUSDT"] });
 * ```
 */
export function useBinancePremiumIndex(
  parameters: UseBinancePremiumIndexParameters = {},
): UseBinancePremiumIndexReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getBinancePremiumIndexQueryOptions(config, { ...parameters, chainId: parameters.chainId ?? chainId });

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseBinancePremiumIndexReturnType;
}
