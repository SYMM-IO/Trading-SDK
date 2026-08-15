"use client";

import { getMarkPricesQueryOptions, type ConfigParameter, type GetMarkPricesOptions } from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Parameters for {@link useMarkPrices}. */
export type UseMarkPricesParameters = GetMarkPricesOptions & ConfigParameter;

/** Value returned by {@link useMarkPrices}. */
export type UseMarkPricesReturnType = UseQueryResult<
  Awaited<ReturnType<ReturnType<typeof getMarkPricesQueryOptions>["queryFn"]>>,
  SymmioRequestError
>;

/**
 * Read a one-shot mark-price snapshot from whichever provider serves the
 * resolved solver.
 *
 * Use this for a first paint before the live feed connects, or anywhere a
 * point-in-time read is wanted instead of a subscription. For a continuously
 * updating value use {@link usePrices} or `usePriceByName`.
 *
 * On Binance, passing exactly one name takes the single-symbol request form
 * (measured weight 1) instead of the all-symbols form (weight 10).
 *
 * @example
 * ```tsx
 * const { data } = useMarkPrices({ solverId: "rasa", names: ["BTCUSDT"] });
 * ```
 */
export function useMarkPrices(parameters: UseMarkPricesParameters = {}): UseMarkPricesReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();
  const options = getMarkPricesQueryOptions(config, { ...parameters, chainId: parameters.chainId ?? chainId });

  return useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseMarkPricesReturnType;
}
