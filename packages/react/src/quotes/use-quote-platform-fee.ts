"use client";

import {
  calculateClosePlatformFee,
  calculateOpenPlatformFee,
  type UnifiedQuote,
} from "@symm-frontier/core";
import { useMemo } from "react";

/**
 * Parameters for {@link useQuotePlatformFee}.
 */
export interface UseQuotePlatformFeeParameters {
  /** Unified quote to compute the open + close platform fees for. */
  quote?: UnifiedQuote;
}

/**
 * Return type of {@link useQuotePlatformFee}.
 */
export interface UseQuotePlatformFeeReturnType {
  /** Open-side platform fee in 18-decimal-wei collateral units. `0n` when the quote has no opened price yet. */
  openFee: bigint;
  /** Close-side platform fee in 18-decimal-wei collateral units. `0n` when the quote has no closed portion yet. */
  closeFee: bigint;
}

const EMPTY: UseQuotePlatformFeeReturnType = { openFee: 0n, closeFee: 0n };

/**
 * Compute the open-side platform fee for a {@link UnifiedQuote}, plus the close-side
 * platform fee when the quote has a non-zero closed portion (full or partial close).
 *
 * Pulls `quantity`, `openedPrice`, and the open-fee rate (`tradingFee`) for the open
 * leg; uses `closedAmount`, `avgClosedPrice`, and `closeFee` for the close leg.
 *
 * @example
 * ```tsx
 * const { openFee, closeFee } = useQuotePlatformFee({ quote });
 * ```
 */
export function useQuotePlatformFee(parameters: UseQuotePlatformFeeParameters): UseQuotePlatformFeeReturnType {
  const { quote } = parameters;

  return useMemo(() => {
    if (!quote) return EMPTY;

    const openFee = calculateOpenPlatformFee({
      quantity: quote.quantity,
      openedPrice: quote.openedPrice ?? 0n,
      openFeeRate: quote.tradingFee ?? 0n,
    });

    const closedAmount = quote.closedAmount ?? 0n;
    const closeFee =
      closedAmount > 0n
        ? calculateClosePlatformFee({
          quantity: closedAmount,
          closePrice: quote.avgClosedPrice ?? 0n,
          closeFeeRate: quote.closeFee ?? 0n,
        })
        : 0n;

    return { openFee, closeFee };
  }, [quote]);
}
