"use client";

import {
  getEstimatedPriceQueryOptions,
  type ConfigParameter,
  type GetEstimatedPriceOptions,
  type GetEstimatedPriceReturnType,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { useDebouncedValue } from "./use-debounced-value";

/** Default debounce (ms) applied to the typed `quantity` / `price` inputs. */
const DEFAULT_DEBOUNCE_MS = 500;

/**
 * Parameters for {@link useEstimatedPrice}: the core query options (`symbolId`,
 * `quantity`, `positionType`, `entry`, `price`, chain id, TanStack `query`
 * overrides), an optional `config`, and an optional `debounceMs`.
 */
export type UseEstimatedPriceParameters = GetEstimatedPriceOptions &
  ConfigParameter & {
    /**
     * Debounce (ms) applied to `quantity` and `price` so one request fires once
     * the user stops typing — not one per keystroke. Defaults to
     * {@link DEFAULT_DEBOUNCE_MS} (350); set `0` to disable.
     */
    debounceMs?: number;
  };

/** Return type of {@link useEstimatedPrice}. */
export type UseEstimatedPriceReturnType = UseQueryResult<GetEstimatedPriceReturnType, SymmioRequestError>;

/**
 * Ask the solver what price an open or close would **fill at** — a read-only
 * simulation of the trade (`/estimated-price`; nothing is submitted). Use it to
 * preview the fill price, the price impact
 * ([`calculatePriceImpact`](../../core/solvers/estimated-price)) and — for a
 * close — an estimated PnL, before the user submits.
 *
 * `price` is the **slippage-adjusted request price** the caller computed (not the
 * raw mark). The query is disabled until `quantity` and `price` are non-empty, so
 * it doesn't fire on partial input. `quantity` and `price` are **debounced
 * internally** (`debounceMs`, default 350) so typing an amount fires a single
 * request once the user settles — the caller passes the raw input, no external
 * debounce needed. Errors are normalized to {@link SymmioRequestError}.
 *
 * @example
 * ```tsx
 * const { data } = useEstimatedPrice({
 *   symbolId,
 *   quantity: tradeParams.quantity,
 *   positionType,
 *   entry: "open",
 *   price: tradeParams.price, // slippage-adjusted
 * });
 * // data?.estimatedPrice
 * ```
 */
export function useEstimatedPrice(parameters: UseEstimatedPriceParameters): UseEstimatedPriceReturnType {
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  // The amount and request price change on every keystroke; debounce them so the
  // solver is hit once the user settles, not once per digit. Market, side, and
  // entry change discretely and pass through untouched. `debounceMs` is pulled
  // out so it never leaks into the query options / cache key.
  const { debounceMs, ...queryParams } = parameters;
  const quantity = useDebouncedValue(parameters.quantity, debounceMs ?? DEFAULT_DEBOUNCE_MS);
  const price = useDebouncedValue(parameters.price, debounceMs ?? DEFAULT_DEBOUNCE_MS);

  const options = getEstimatedPriceQueryOptions(config, {
    ...queryParams,
    quantity,
    price,
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
  }) as UseEstimatedPriceReturnType;
}
