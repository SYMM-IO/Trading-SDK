"use client";

import {
  calculateQuoteLeverage,
  calculateQuotePnl,
  calculateQuoteUpnl,
  type CalculateQuotePnlReturnType,
  type CalculateQuoteUpnlReturnType,
  type ConfigParameter,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { useMemo } from "react";
import { usePriceByMarketId } from "../price-service/use-price-by-market-id";

/**
 * Parameters for {@link useQuoteUpnlAndPnl}.
 */
export interface UseQuoteUpnlAndPnlParameters extends ConfigParameter {
  /** Unified quote to compute UPNL + realized PNL for. */
  quote?: UnifiedQuote;
}

/**
 * Return type of {@link useQuoteUpnlAndPnl}.
 */
export interface UseQuoteUpnlAndPnlReturnType extends CalculateQuoteUpnlReturnType, CalculateQuotePnlReturnType {
  /** Mark price used in the calc, decimal string. `null` until the first tick. */
  markPrice: string | null;
  /** Leverage derived from the quote's locked-margin breakdown, decimal string. */
  leverage: string;
  /** `true` while markets or mark-price are resolving. */
  isLoading: boolean;
}

const EMPTY: UseQuoteUpnlAndPnlReturnType = {
  upnl: "0",
  upnlPercent: "0",
  pnl: "0",
  pnlPercent: "0",
  markPrice: null,
  leverage: "0",
  isLoading: false,
};

/**
 * Compute unrealized PNL (open size, vs mark) and realized PNL (closed size,
 * vs the quote's recorded close price) for a single {@link UnifiedQuote}.
 *
 * Mark price is resolved live via {@link usePriceByMarketId} on the quote's
 * `symbolId` — from whichever price provider serves the chain's resolved solver
 * (Enigma on lowcap chains, Binance on majors chains). UPNL stays `"0"` until
 * the first tick for that market arrives.
 *
 * @example
 * ```tsx
 * const { upnl, upnlPercent, pnl, pnlPercent, markPrice } = useQuoteUpnlAndPnl({ quote });
 * ```
 */
export function useQuoteUpnlAndPnl(parameters: UseQuoteUpnlAndPnlParameters): UseQuoteUpnlAndPnlReturnType {
  const { quote } = parameters;

  const priceQuery = usePriceByMarketId({
    marketId: quote?.symbolId ?? 0n,
    enabled: quote !== undefined,
  });

  return useMemo(() => {
    if (!quote) return EMPTY;

    const lockedValuesForLeverage = quote.initialLockedValues ?? quote.lockedValues;
    const leverage = calculateQuoteLeverage({
      quantity: quote.quantity,
      requestedOpenPrice: quote.requestedOpenPrice,
      lockedValues: lockedValuesForLeverage,
    });

    const closedAmount = quote.closedAmount ?? 0n;
    const markPrice = priceQuery.markPrice;

    const { upnl, upnlPercent } = markPrice
      ? calculateQuoteUpnl({
          markPrice,
          positionType: quote.positionType,
          quantity: quote.quantity,
          closedAmount,
          openedPrice: quote.openedPrice ?? 0n,
          leverage,
        })
      : { upnl: "0", upnlPercent: "0" };

    const { pnl, pnlPercent } = calculateQuotePnl({
      positionType: quote.positionType,
      closedAmount,
      closedPrice: quote.avgClosedPrice ?? 0n,
      openedPrice: quote.openedPrice ?? 0n,
      leverage,
    });

    return {
      upnl,
      upnlPercent,
      pnl,
      pnlPercent,
      markPrice,
      leverage,
      isLoading: priceQuery.isLoading,
    };
  }, [quote, priceQuery.markPrice, priceQuery.isLoading]);
}
