"use client";

import type { QuotePendingFunding, UnifiedQuote } from "@symmio/trading-core";
import { useMemo } from "react";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useQuotesPendingFunding, type UseQuotesPendingFundingParameters } from "./use-quotes-pending-funding";

/**
 * Parameters for {@link useQuotePendingFunding}: everything
 * {@link useQuotesPendingFunding} takes (chain id, batch size, TanStack `query`
 * overrides, `config`) except the list, which is replaced by one `quote`.
 */
export interface UseQuotePendingFundingParameters extends Omit<UseQuotesPendingFundingParameters, "quotes"> {
  /**
   * The quote. `undefined`, off-chain (no `quoteId`) or not an active position
   * disables the read. Takes the quote rather than a bare id so the status
   * filter cannot be bypassed.
   */
  quote?: Pick<UnifiedQuote, "quoteId" | "quoteStatus">;
}

/**
 * Return type of {@link useQuotePendingFunding}.
 */
export interface UseQuotePendingFundingReturnType {
  /**
   * The quote's pending funding (income-positive `pendingNetReceived`), or `null`
   * when the quote is not read (see {@link UseQuotePendingFundingParameters.quote})
   * or until the read resolves.
   */
  data: QuotePendingFunding | null;
  /** `true` while the first read is in flight (no data yet). */
  isLoading: boolean;
  /** `true` while any read is in flight, including a background refetch. */
  isFetching: boolean;
  /** Normalized request error, when the read failed. */
  error: SymmioRequestError | null;
  /** Re-read the pending funding now. */
  refetch: () => void;
}

/** Stable empty list so the batch hook's memos don't churn while there is no quote to read. */
const EMPTY_QUOTES: readonly Pick<UnifiedQuote, "quoteId" | "quoteStatus">[] = [];

/**
 * Read the **pending** (accrued, not yet settled) accumulated funding of a single
 * quote — income-positive, so `data.pendingNetReceived > 0n` means the position
 * will receive funding and `< 0n` means it owes it.
 *
 * Thin wrapper over {@link useQuotesPendingFunding} with a one-element list, so
 * the same rules apply: only a quote with a `quoteId` and a known active
 * `quoteStatus` is read, there is no default polling (pass
 * `query.refetchInterval`), and settled funding is a separate read
 * ({@link useQuoteFunding}) that must not be added to this one. `chainId`
 * defaults to the connected chain; errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @param parameters - The quote, plus optional chain id, TanStack `query` overrides and `config`.
 * @returns The quote's pending funding row (or `null`) and query state.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useQuotePendingFunding({
 *   quote,
 *   query: { refetchInterval: 60_000 },
 * });
 * // `data.pendingNetReceived < 0n` → the position owes funding when it settles.
 * ```
 */
export function useQuotePendingFunding(parameters: UseQuotePendingFundingParameters): UseQuotePendingFundingReturnType {
  const { quote, ...rest } = parameters;
  const quoteId = quote?.quoteId;
  const quoteStatus = quote?.quoteStatus;

  /** Keyed on the two primitives, not the `quote` object, so a fresh-but-equal quote keeps the list stable. */
  const quotes = useMemo(
    () => (quoteId === undefined ? EMPTY_QUOTES : [{ quoteId, quoteStatus }]),
    [quoteId, quoteStatus],
  );

  const batch = useQuotesPendingFunding({ ...rest, quotes });
  const data = batch.rows[0] ?? null;

  return useMemo(
    () => ({
      data,
      isLoading: batch.isLoading,
      isFetching: batch.isFetching,
      error: batch.error,
      refetch: batch.refetch,
    }),
    [data, batch.isLoading, batch.isFetching, batch.error, batch.refetch],
  );
}
