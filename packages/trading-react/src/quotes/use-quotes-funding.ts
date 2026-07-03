"use client";

import {
  getQuoteFundingQueryOptions,
  type ConfigParameter,
  type GetQuoteFundingOptions,
  type QuoteFundingData,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/** Minimum quote shape `useQuotesFunding` needs: just the on-chain id. */
export interface QuotesFundingInputQuote {
  /** On-chain quote id. Off-chain (pending) rows pass `undefined` and are skipped. */
  quoteId?: bigint;
}

/**
 * Parameters for {@link useQuotesFunding}.
 */
export interface UseQuotesFundingParameters extends Omit<GetQuoteFundingOptions, "quoteIds">, ConfigParameter {
  /**
   * Quotes (or quote-id-bearing rows) to read funding for. Off-chain rows
   * (`quoteId === undefined`) are silently skipped. All resolved on-chain ids
   * are fetched in a single subgraph round-trip.
   */
  quotes: readonly QuotesFundingInputQuote[];
}

/**
 * Return type of {@link useQuotesFunding}.
 */
export interface UseQuotesFundingReturnType {
  /** Funding row per input quote, in input order. `null` for off-chain rows or ids the subgraph hasn't surfaced yet. */
  rows: Array<QuoteFundingData | null>;
  /** Σ paid across resolved rows (wei). */
  paid: bigint;
  /** Σ received across resolved rows (wei). */
  received: bigint;
  /** Σ net (paid − received) across resolved rows (wei). */
  net: bigint;
  /** Subset of input ids the subgraph has not yet returned (indexing lag). */
  missingQuoteIds: bigint[];
  /** `true` while the underlying subgraph query is loading. */
  isLoading: boolean;
  /** Normalized request error, when one occurred. */
  error: SymmioRequestError | null;
}

const EMPTY: UseQuotesFundingReturnType = {
  rows: [],
  paid: 0n,
  received: 0n,
  net: 0n,
  missingQuoteIds: [],
  isLoading: false,
  error: null,
};

/**
 * Batch-read funding totals for a list of quotes from the analytics subgraph in
 * a single round-trip and aggregate them into running sums for the group.
 *
 * The hook is the canonical entry point for both single-quote details panels
 * ({@link useQuoteFunding} delegates here with a 1-element list) and grouped
 * quote cards (which want `Σ net`). Off-chain rows are skipped silently.
 *
 * @example
 * ```tsx
 * const { rows, net, isLoading } = useQuotesFunding({ quotes: group.quotes });
 * ```
 */
export function useQuotesFunding(parameters: UseQuotesFundingParameters): UseQuotesFundingReturnType {
  const { quotes, ...rest } = parameters;
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  const onchainQuoteIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: bigint[] = [];
    for (const quote of quotes) {
      if (quote.quoteId === undefined) continue;
      const key = quote.quoteId.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      ids.push(quote.quoteId);
    }
    return ids;
  }, [quotes]);

  const options = getQuoteFundingQueryOptions(config, {
    ...rest,
    chainId: rest.chainId ?? chainId,
    quoteIds: onchainQuoteIds,
  });

  const query = useQuery({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (err) {
        throw normalizeSymmError(err);
      }
    },
  }) as UseQueryResult<{ rows: QuoteFundingData[]; missingQuoteIds: bigint[] }, SymmioRequestError>;

  return useMemo(() => {
    if (onchainQuoteIds.length === 0) return EMPTY;
    const data = query.data;
    if (!data) {
      return {
        rows: quotes.map(() => null),
        paid: 0n,
        received: 0n,
        net: 0n,
        missingQuoteIds: [],
        isLoading: query.isLoading,
        error: query.error ?? null,
      };
    }

    const byQuoteId = new Map<string, QuoteFundingData>();
    for (const row of data.rows) byQuoteId.set(row.quoteId.toString(), row);

    let paid = 0n;
    let received = 0n;
    let net = 0n;
    const rows = quotes.map((quote) => {
      if (quote.quoteId === undefined) return null;
      const row = byQuoteId.get(quote.quoteId.toString()) ?? null;
      if (row) {
        paid += row.paid;
        received += row.received;
        net += row.net;
      }
      return row;
    });

    return {
      rows,
      paid,
      received,
      net,
      missingQuoteIds: data.missingQuoteIds,
      isLoading: query.isLoading,
      error: query.error ?? null,
    };
  }, [onchainQuoteIds, quotes, query.data, query.isLoading, query.error]);
}
