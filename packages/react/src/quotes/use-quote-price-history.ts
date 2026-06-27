"use client";

import { PRICE_HISTORY_EVENT_TYPES, type ConfigParameter } from "@symm-frontier/core";
import {
  useQuoteEventsByType,
  type UseQuoteEventsByTypeParameters,
  type UseQuoteEventsByTypeReturnType,
} from "./use-quote-events-by-type";

/**
 * Parameters for {@link useQuotePriceHistory}. Same as {@link useQuoteEventsByType}
 * minus the `types` field (preset to {@link PRICE_HISTORY_EVENT_TYPES}).
 */
export type UseQuotePriceHistoryParameters = Omit<UseQuoteEventsByTypeParameters, "types"> & ConfigParameter;

/**
 * Read a quote's open-price history from the analytics subgraph. The history
 * includes both explicit price-recompute events (`SETTLE_UPNL`) and funding-rate
 * ticks (`CHARGE_FUNDING_RATE`, `CHARGE_ACCUMULATED_FUNDING_FEE`), which also
 * shift the open price as a side effect. Each row carries a `type` discriminant
 * so the UI can label and format it per event family.
 *
 * Thin wrapper over {@link useQuoteEventsByType} that locks `types` to
 * {@link PRICE_HISTORY_EVENT_TYPES}.
 *
 * @example
 * ```tsx
 * const { data } = useQuotePriceHistory({ quoteId: quote.quoteId });
 * ```
 */
export function useQuotePriceHistory(parameters: UseQuotePriceHistoryParameters): UseQuoteEventsByTypeReturnType {
  return useQuoteEventsByType({ ...parameters, types: PRICE_HISTORY_EVENT_TYPES });
}
