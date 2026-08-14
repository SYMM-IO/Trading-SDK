"use client";

import {
  getQuoteTpSlQueryOptions,
  summarizeQuoteGroupTpSl,
  toGroupTpSlChildren,
  toGroupTpSlOrders,
  type ConfigParameter,
  type GetQuoteTpSlOptions,
  type GroupTpSlChild,
  type GroupTpSlDesiredMap,
  type GroupTpSlOrder,
  type QuoteGroupTpSlSummary,
  type QuoteTpSl,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { useQueries } from "@tanstack/react-query";
import { useCallback, useMemo, useRef } from "react";
import type { Address } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { useTpSlRecords, useTpSlStore } from "./tpsl-store";
import { dedupeAddresses, useWatchTpSlAccounts } from "./use-watch-tpsl-accounts";

/** Parameters for {@link useQuoteGroupTpSl}. */
export interface UseQuoteGroupTpSlParameters extends ConfigParameter {
  /** The grouped position's child quotes — pass `group.quotes`. */
  quotes: readonly UnifiedQuote[];
  /**
   * SubAccount that owns the children's Virtual Accounts.
   *
   * Pass it. The handler publishes TP/SL reports on the **subscribing account's**
   * stream, not on the VA that owns the order — a report's `address` is the same
   * for two quotes under different VAs. Without it this hook only hears the VA
   * channels, and a live update arrives whenever the next REST read happens to run.
   */
  subAccount?: Address;
  /**
   * Accounts whose TP/SL streams report on these children. Overrides the
   * default, which is `subAccount` plus the deduped `vaAddress ?? partyA`
   * across `quotes` — a grouped position can span Virtual Accounts, since the
   * VA is not part of the group key.
   */
  accounts?: readonly Address[];
  /** Pending per-child edits that win over the confirmed snapshot. */
  overrides?: GroupTpSlDesiredMap;
  /** Subscribe to the TP/SL WebSocket. Default `true`. */
  live?: boolean;
  /** Master switch. When `false` every child query is idle. Default `true`. */
  enabled?: boolean;
  /** Chain override; defaults to the connected chain. */
  chainId?: number;
  /** Query overrides forwarded to every child fetch. */
  query?: GetQuoteTpSlOptions["query"];
}

/** Return type of {@link useQuoteGroupTpSl}. */
export interface UseQuoteGroupTpSlReturnType {
  /** Children with their confirmed snapshots, in input order — the input to every core helper. */
  children: GroupTpSlChild[];
  /** Folded cell/modal state: counts, uniform-vs-mixed, notional coverage. */
  summary: QuoteGroupTpSlSummary;
  /** One row per live-or-desired TP/SL order, for an overview list. */
  orders: GroupTpSlOrder[];
  /** `true` while any child's first fetch is in flight. */
  isLoading: boolean;
  /** `true` while any child query is fetching, including background refetches. */
  isFetching: boolean;
  /** First normalized error across the fan-out, or `null`. */
  error: SymmioRequestError | null;
  /** Refetch every child. Resolves when all settle. */
  refetch: () => Promise<void>;
}

/**
 * Read the folded TP/SL state of a grouped position.
 *
 * One TanStack query per child — keyed with the shared `getQuoteTpSlQueryKey`,
 * so a row that also renders the per-quote `useQuoteTpSl` issues **one** request
 * per quote rather than two — all writing into the same module-level TP/SL
 * store, plus one WebSocket subscription per **distinct account** rather than
 * one per child. Everything above the store is `@symmio/trading-core`'s pure
 * `summarizeQuoteGroupTpSl` / `toGroupTpSlOrders`.
 *
 * @param parameters - The group's quotes plus optional accounts, edits and query overrides.
 * @returns Children, the folded summary, the order rows, and the load surface.
 *
 * @example
 * ```tsx
 * const { summary, children } = useQuoteGroupTpSl({ quotes: group.quotes });
 * if (summary.isEmpty) return <span>Not set</span>;
 * if (summary.takeProfit.display === "uniform") return <span>{summary.takeProfit.price}</span>;
 * return <span>{summary.takeProfit.count} TP</span>;
 * ```
 */
export function useQuoteGroupTpSl(parameters: UseQuoteGroupTpSlParameters): UseQuoteGroupTpSlReturnType {
  const { quotes, overrides, live = true, enabled = true } = parameters;
  const config = useSymmioConfig(parameters);
  const defaultChainId = useSymmioChainId();
  const chainId = parameters.chainId ?? defaultChainId;

  /** One addressable TP/SL id per child: the on-chain id, else the hedger temp id. */
  const ids = useMemo(() => quotes.map(tpslIdOf), [quotes]);

  const results = useQueries({
    queries: quotes.map((_quote, index) => {
      const id = ids[index] ?? 0n;
      const options = getQuoteTpSlQueryOptions(config, { chainId, quoteId: id, query: parameters.query });
      return {
        ...options,
        enabled: (options.enabled ?? true) && enabled,
        queryFn: async () => {
          try {
            const rows = await options.queryFn();
            useTpSlStore.getState().setRows(id, rows);
            return rows;
          } catch (err) {
            throw normalizeSymmError(err);
          }
        },
      };
    }),
  });

  /**
   * Accounts to watch: the SubAccount, where the handler publishes its reports,
   * plus every Virtual Account the children live under — a grouped position can
   * span several, and one of them may be where a given deployment reports.
   */
  const accounts = useMemo(() => {
    if (parameters.accounts) return dedupeAddresses(parameters.accounts);
    return dedupeAddresses([parameters.subAccount, ...quotes.map((quote) => quote.vaAddress ?? quote.partyA)]);
  }, [parameters.accounts, parameters.subAccount, quotes]);

  useWatchTpSlAccounts({
    accounts,
    ids,
    chainId,
    config: parameters.config,
    enabled: live && enabled,
  });

  const records = useTpSlRecords(ids);
  const children = useMemo(() => {
    const byKey = new Map<string, QuoteTpSl | undefined>();
    quotes.forEach((quote, index) => byKey.set(quote.key, records[index]));
    return toGroupTpSlChildren(quotes, (quote) => byKey.get(quote.key));
  }, [quotes, records]);

  const summary = useMemo(() => summarizeQuoteGroupTpSl(children, { overrides }), [children, overrides]);
  const orders = useMemo(() => toGroupTpSlOrders(children, { overrides }), [children, overrides]);

  /** `useQueries` hands back a fresh array each render; keep `refetch` stable. */
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const refetch = useCallback(async () => {
    await Promise.all(resultsRef.current.map((result) => result.refetch()));
  }, []);

  return {
    children,
    summary,
    orders,
    isLoading: results.some((result) => result.isLoading),
    isFetching: results.some((result) => result.isFetching),
    error: (results.find((result) => result.error)?.error as SymmioRequestError | undefined) ?? null,
    refetch,
  };
}

/** The id a quote's TP/SL record is addressed by: on-chain first, else the hedger temp id. */
function tpslIdOf(quote: UnifiedQuote): bigint | undefined {
  if (quote.quoteId !== undefined) return quote.quoteId;
  if (quote.tempQuoteId !== undefined) return BigInt(quote.tempQuoteId);
  return undefined;
}
