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
   * (`quoteId === undefined`) are silently skipped. The resolved on-chain ids are
   * de-duplicated and fetched in a single subgraph round-trip, so listing the
   * same quote twice costs one request and contributes to the sums once.
   */
  quotes: readonly QuotesFundingInputQuote[];
}

/**
 * Return type of {@link useQuotesFunding}.
 */
export interface UseQuotesFundingReturnType {
  /**
   * Funding row per input quote, aligned 1:1 with `quotes` and in input order —
   * `rows.length === quotes.length` on every path, including while loading and
   * when nothing on-chain was requested. An entry is `null` for an off-chain row
   * (no `quoteId`) or for an id the subgraph has not surfaced yet.
   */
  rows: Array<QuoteFundingData | null>;
  /**
   * Σ funding paid across the resolved rows (wei). Summed over the **distinct**
   * on-chain ids, so a quote listed twice contributes once.
   */
  paid: bigint;
  /**
   * Σ funding received across the resolved rows (wei). Summed over the
   * **distinct** on-chain ids, so a quote listed twice contributes once.
   */
  received: bigint;
  /**
   * Σ `paid − received` across the resolved rows (wei). **Positive = the user
   * net-paid funding**; negative = they net-received it. A lower bound while
   * `missingQuoteIds` is non-empty.
   */
  net: bigint;
  /**
   * Requested on-chain ids that have no funding row yet. While the query is in
   * flight — and if it fails — this is **every** requested id, since nothing has
   * resolved; once it settles it is the subset the subgraph did not return
   * (indexing lag). Always empty when no on-chain ids were requested.
   */
  missingQuoteIds: bigint[];
  /** `true` while the underlying subgraph query is loading. */
  isLoading: boolean;
  /** Normalized request error, when one occurred. */
  error: SymmioRequestError | null;
}

/**
 * Batch-read funding totals for a list of quotes from the analytics subgraph in
 * a single round-trip and aggregate them into running sums for the group.
 *
 * The hook is the canonical entry point for both single-quote details panels
 * ({@link useQuoteFunding} delegates here with a 1-element list) and grouped
 * quote cards (which want `Σ net`). Off-chain rows are skipped silently, and
 * duplicate ids are fetched — and summed — exactly once.
 *
 * **Sign convention** — `net = paid − received`, so a **positive** `net` means
 * the user has net-**paid** funding. This matches `QuoteFundingData.net` and the
 * on-chain `int256`. A UI that prefers "green = income" must invert for display
 * at the render layer, not here.
 *
 * **Settled to date only** — the totals cover funding the protocol has already
 * charged and the analytics subgraph has indexed. Funding accrued since a
 * quote's last funding charge is not indexed anywhere and is therefore not
 * included.
 *
 * @param parameters - The quotes to read funding for, plus optional chain/config overrides.
 * @returns Per-quote rows aligned with `quotes`, the aggregate sums, and query state.
 *
 * @example
 * ```tsx
 * const { rows, net, missingQuoteIds, isLoading } = useQuotesFunding({ quotes: group.quotes });
 * // `net > 0n` → the user net-paid funding across the resolved rows.
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
    /** Nothing on-chain to read: the query is disabled, but `rows` still owes one entry per input quote. */
    if (onchainQuoteIds.length === 0) {
      return {
        rows: quotes.map(() => null),
        paid: 0n,
        received: 0n,
        net: 0n,
        missingQuoteIds: [],
        isLoading: false,
        error: null,
      };
    }

    const data = query.data;
    if (!data) {
      return {
        rows: quotes.map(() => null),
        paid: 0n,
        received: 0n,
        net: 0n,
        /** In flight (or failed): nothing resolved, so every requested id is still outstanding. */
        missingQuoteIds: [...onchainQuoteIds],
        isLoading: query.isLoading,
        error: query.error ?? null,
      };
    }

    /** First row wins per id — a repeated row for the same quote must not double-count. */
    const byQuoteId = new Map<string, QuoteFundingData>();
    for (const row of data.rows) {
      const key = row.quoteId.toString();
      if (!byQuoteId.has(key)) byQuoteId.set(key, row);
    }

    let paid = 0n;
    let received = 0n;
    /** Fold over the de-duped ids, never over `quotes` — the same id listed twice is fetched once and must sum once. */
    for (const quoteId of onchainQuoteIds) {
      const row = byQuoteId.get(quoteId.toString());
      if (row === undefined) continue;
      paid += row.paid;
      received += row.received;
    }

    /** Built by lookup afterwards, so the 1:1 alignment with `quotes` is independent of the fold. */
    const rows = quotes.map((quote) =>
      quote.quoteId === undefined ? null : (byQuoteId.get(quote.quoteId.toString()) ?? null),
    );

    return {
      rows,
      paid,
      received,
      /** Derived from the sums so the aggregate keeps the row-level `net = paid − received` invariant. */
      net: paid - received,
      missingQuoteIds: data.missingQuoteIds,
      isLoading: query.isLoading,
      error: query.error ?? null,
    };
  }, [onchainQuoteIds, quotes, query.data, query.isLoading, query.error]);
}
