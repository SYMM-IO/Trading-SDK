"use client";

import type { ConfigParameter, QuoteFundingData } from "@symmio/trading-core";
import { useMemo } from "react";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useQuotesFunding } from "./use-quotes-funding";

/**
 * Parameters for {@link useQuoteFunding}.
 */
export interface UseQuoteFundingParameters extends ConfigParameter {
  /** On-chain quote id. `undefined` (off-chain) disables the query. */
  quoteId?: bigint;
  /** Optional chain id override; defaults to the connected chain. */
  chainId?: number;
}

/**
 * Return type of {@link useQuoteFunding}.
 */
export interface UseQuoteFundingReturnType {
  /** The funding row for this quote, or `null` until it resolves. */
  data: QuoteFundingData | null;
  /** `true` while the subgraph query is loading. */
  isLoading: boolean;
  /** Normalized request error, when one occurred. */
  error: SymmioRequestError | null;
}

const EMPTY_QUOTES: readonly { quoteId?: bigint }[] = [];

/**
 * Read funding totals (paid / received / net) for a single on-chain quote.
 * Disabled while `quoteId` is `undefined` (off-chain row).
 *
 * Thin wrapper over {@link useQuotesFunding} with a one-element batch.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useQuoteFunding({ quoteId: quote.quoteId });
 * ```
 */
export function useQuoteFunding(parameters: UseQuoteFundingParameters): UseQuoteFundingReturnType {
  const { quoteId, chainId, config } = parameters;

  const quotes = useMemo(() => (quoteId === undefined ? EMPTY_QUOTES : [{ quoteId }]), [quoteId]);

  const batch = useQuotesFunding({ quotes, chainId, config });

  return {
    data: batch.rows[0] ?? null,
    isLoading: batch.isLoading,
    error: batch.error,
  };
}
