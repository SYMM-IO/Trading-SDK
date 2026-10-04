"use client";

import {
  getQuotePendingFundingQueryOptions,
  isActiveQuoteStatus,
  type ConfigParameter,
  type GetQuotePendingFundingOptions,
  type GetQuotePendingFundingReturnType,
  type QuotePendingFunding,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";

/**
 * Parameters for {@link useQuotesPendingFunding}: the core query options minus
 * `quoteIds` (derived from `quotes`) — chain id, batch size and TanStack `query`
 * overrides — plus an optional `config`.
 */
export interface UseQuotesPendingFundingParameters
  extends Omit<GetQuotePendingFundingOptions, "quoteIds">, ConfigParameter {
  /**
   * Quotes to read (a `UnifiedQuote[]` fits). Only rows with a `quoteId` and a
   * known active `quoteStatus` are read (see {@link isActiveQuoteStatus}); every
   * other row is skipped and gets a `null` entry in `rows`. The readable ids are
   * de-duplicated, so listing the same quote twice reads it once and sums it once.
   */
  quotes: readonly Pick<UnifiedQuote, "quoteId" | "quoteStatus">[];
}

/**
 * Return type of {@link useQuotesPendingFunding}.
 */
export interface UseQuotesPendingFundingReturnType {
  /**
   * One entry per input quote, aligned by index — `rows.length === quotes.length`
   * on every path. An entry is `null` for a row that is not read (no `quoteId`, or
   * a status that is unknown or not an active position) or until the read resolves.
   */
  rows: readonly (QuotePendingFunding | null)[];
  /**
   * Σ `pendingNetReceived` over the **distinct** ids read, income-positive
   * (`> 0n` the positions will receive funding, `< 0n` they owe it), 18-decimal
   * collateral units. `undefined` until the read has resolved every one of those
   * ids (like `useAccountUpnl`), so a partial sum is never mistaken for the total;
   * `0n` when no quote is readable.
   */
  pendingNetReceived?: bigint;
  /** `true` while the first read is in flight (no data yet). */
  isLoading: boolean;
  /** `true` while any read is in flight, including a background refetch. */
  isFetching: boolean;
  /** Normalized request error, when the read failed. */
  error: SymmioRequestError | null;
  /** Re-read the pending funding now. */
  refetch: () => void;
}

/**
 * The quote's on-chain id when its pending funding is meaningful to read — it has
 * an id and a **known, active** on-chain status — else `undefined`. The diamond
 * view does not check status, so a quote a solver locked but never opened would
 * otherwise read as a large, growing and meaningless amount.
 */
function readableQuoteId(quote: Pick<UnifiedQuote, "quoteId" | "quoteStatus">): bigint | undefined {
  if (quote.quoteId === undefined || quote.quoteStatus === undefined) return undefined;
  return isActiveQuoteStatus(quote.quoteStatus) ? quote.quoteId : undefined;
}

/**
 * Read the **pending** (accrued, not yet settled) accumulated funding of a list of
 * quotes from the SYMMIO core diamond, per quote and as one total.
 *
 * Wraps core's `getQuotePendingFunding`, which reads the diamond view
 * `getQuoteFundingDebts` and negates it, so every amount is **income-positive**
 * like the rest of the SDK's funding amounts: `pendingNetReceived > 0n` means the
 * position will receive funding, `< 0n` means it owes it. Each value is what the
 * contract would settle if the quote were charged in the block the RPC ran the
 * call against; it moves in whole-epoch steps and also changes when the solver
 * updates its rates or the quote is charged, partially closed or liquidated. It is
 * `0n` for pairs whose accumulated funding has not started.
 *
 * **Only active positions are read.** A row needs a `quoteId` and a known
 * `quoteStatus` that is `OPENED`, `CLOSE_PENDING`, `CANCEL_CLOSE_PENDING` or
 * `LIQUIDATED_PENDING` ({@link isActiveQuoteStatus}); anything else — an off-chain
 * row, a `LOCKED` or `EXPIRED` quote, a row whose status is not known yet — is
 * never sent and reads `null`. Readable ids are de-duplicated and read in core's
 * sequential batches (`batchSize`, default 25); each batch is its own `eth_call`,
 * so with more than one batch the rows can come from adjacent blocks.
 *
 * **No default polling.** The value grows with time even when nothing happens on
 * the quote, and no event announces that — pass `query.refetchInterval` to keep it
 * fresh. {@link useManagedQuotes} invalidates it together with its on-chain quote
 * reads, and {@link useForceClose} after its receipt.
 *
 * **Settled vs pending.** Funding already charged is read from the analytics
 * subgraph with {@link useQuotesFunding}. The two come from different sources at
 * different heights, so do not add them into a lifetime total. A Muon-signed uPnL
 * already includes accumulated funding — do not net pending funding against it.
 *
 * `chainId` defaults to the connected chain. Errors are normalized to
 * {@link SymmioRequestError}.
 *
 * @param parameters - The quotes to read, plus optional chain id, batch size, TanStack `query` overrides and `config`.
 * @returns Per-quote rows aligned with `quotes`, the total, and query state.
 *
 * @example
 * ```tsx
 * const { quotes } = useManagedQuotes({ partyA: subAccount });
 * const { rows, pendingNetReceived, isLoading } = useQuotesPendingFunding({
 *   quotes,
 *   query: { refetchInterval: 60_000 },
 * });
 * // `pendingNetReceived > 0n` → the open positions will receive funding when it settles.
 * ```
 */
export function useQuotesPendingFunding(
  parameters: UseQuotesPendingFundingParameters,
): UseQuotesPendingFundingReturnType {
  const { quotes, ...rest } = parameters;
  const config = useSymmioConfig(parameters);
  const chainId = useSymmioChainId();

  const readableQuoteIds = useMemo(() => {
    const seen = new Set<string>();
    const ids: bigint[] = [];
    for (const quote of quotes) {
      const quoteId = readableQuoteId(quote);
      if (quoteId === undefined) continue;
      const key = quoteId.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      ids.push(quoteId);
    }
    return ids;
  }, [quotes]);

  const options = getQuotePendingFundingQueryOptions(config, {
    ...rest,
    chainId: rest.chainId ?? chainId,
    quoteIds: readableQuoteIds,
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
  }) as UseQueryResult<GetQuotePendingFundingReturnType, SymmioRequestError>;

  const { refetch: refetchQuery } = query;
  const refetch = useCallback(() => {
    void refetchQuery();
  }, [refetchQuery]);

  return useMemo(() => {
    /** Nothing readable: the query is disabled, but `rows` still owes one entry per input quote. */
    if (readableQuoteIds.length === 0) {
      return {
        rows: quotes.map(() => null),
        pendingNetReceived: 0n,
        isLoading: false,
        isFetching: false,
        error: null,
        refetch,
      };
    }

    const data = query.data;
    if (!data) {
      return {
        rows: quotes.map(() => null),
        pendingNetReceived: undefined,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        error: query.error ?? null,
        refetch,
      };
    }

    /** First row wins per id — a repeated row for the same quote must not double-count. */
    const byQuoteId = new Map<string, QuotePendingFunding>();
    for (const row of data) {
      const key = row.quoteId.toString();
      if (!byQuoteId.has(key)) byQuoteId.set(key, row);
    }

    /**
     * Fold over the de-duped ids, never over `quotes` — the same id listed twice is
     * read once and must sum once. An id the data does not cover (caller-supplied
     * `placeholderData` from another id set, or a view that answered short) leaves the
     * total unresolved rather than silently partial.
     */
    let total = 0n;
    let complete = true;
    for (const quoteId of readableQuoteIds) {
      const row = byQuoteId.get(quoteId.toString());
      if (row === undefined) {
        complete = false;
        break;
      }
      total += row.pendingNetReceived;
    }

    /** Built by lookup afterwards, so the 1:1 alignment with `quotes` is independent of the fold. */
    const rows = quotes.map((quote) => {
      const quoteId = readableQuoteId(quote);
      return quoteId === undefined ? null : (byQuoteId.get(quoteId.toString()) ?? null);
    });

    return {
      rows,
      pendingNetReceived: complete ? total : undefined,
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      error: query.error ?? null,
      refetch,
    };
  }, [readableQuoteIds, quotes, query.data, query.isLoading, query.isFetching, query.error, refetch]);
}
