"use client";

import {
  getQuoteTpSlQueryOptions,
  summarizeQuoteGroupTpSl,
  toGroupTpSlChildren,
  toGroupTpSlOrders,
  watchTpSlNotifications,
  type ConfigParameter,
  type GetQuoteTpSlOptions,
  type GroupTpSlChild,
  type GroupTpSlDesiredMap,
  type GroupTpSlOrder,
  type QuoteGroupTpSlSummary,
  type QuoteTpSl,
  type TpSlNotification,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { useQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Address } from "viem";
import { normalizeSymmError } from "../errors/normalize-symm-error";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { useSymmioChainId } from "../provider/use-symmio-chain-id";
import { useSymmioConfig } from "../provider/use-symmio-config";
import { linkTpSlNotificationIds, matchTpSlNotification } from "./match-tpsl-notification";
import { useTpSlRecords, useTpSlStore } from "./tpsl-store";

/** Parameters for {@link useQuoteGroupTpSl}. */
export interface UseQuoteGroupTpSlParameters extends ConfigParameter {
  /** The grouped position's child quotes — pass `group.quotes`. */
  quotes: readonly UnifiedQuote[];
  /**
   * Accounts whose TP/SL streams report on these children. Defaults to the
   * deduped `vaAddress ?? partyA` across `quotes`, which is what the per-quote
   * hook subscribes to — a grouped position can span Virtual Accounts, since
   * the VA is not part of the group key. Pass an explicit list (e.g. only the
   * sub-account) to override.
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

  /** Distinct accounts to watch — a grouped position can span Virtual Accounts. */
  const accounts = useMemo(() => {
    const source = parameters.accounts ?? quotes.map((quote) => quote.vaAddress ?? quote.partyA);
    return dedupeAddresses(source);
  }, [parameters.accounts, quotes]);

  useWatchGroupTpSlNotifications({
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

/** Parameters for {@link useWatchGroupTpSlNotifications}. */
interface WatchGroupParameters extends ConfigParameter {
  accounts: readonly Address[];
  ids: readonly (bigint | undefined)[];
  chainId: number | undefined;
  enabled: boolean;
}

/**
 * Subscribe to every account the group's children live under, in one effect.
 *
 * A hook cannot be called once per account (the count changes as the group
 * grows), so this drives the core watcher directly. The SDK's socket pool keys
 * on `(wsUrl, appName, account)`, so this adds handlers to sockets the
 * per-quote hooks already opened rather than new connections.
 */
function useWatchGroupTpSlNotifications(parameters: WatchGroupParameters): void {
  const { accounts, ids, chainId, enabled } = parameters;
  const config = useSymmioConfig(parameters);

  /** Read the live id list from inside the long-lived socket handler. */
  const idsRef = useRef(ids);
  idsRef.current = ids;

  /** Re-subscribe only when the account set genuinely changes. */
  const accountsKey = accounts.map((account) => account.toLowerCase()).join(",");

  useEffect(() => {
    if (!enabled || accounts.length === 0) return;

    const onNotification = (notification: TpSlNotification) => {
      linkTpSlNotificationIds(notification);
      const target = matchTpSlNotification(notification, idsRef.current);
      if (target === undefined) return;
      useTpSlStore.getState().applyNotification(target, notification);
    };

    const unwatchers = accounts.map((account) => watchTpSlNotifications(config, { account, chainId, onNotification }));
    return () => {
      for (const unwatch of unwatchers) unwatch();
    };
    // `accountsKey` stands in for `accounts` — a fresh array with the same
    // members must not tear down and rebuild the subscriptions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountsKey, chainId, config, enabled]);
}

/** The id a quote's TP/SL record is addressed by: on-chain first, else the hedger temp id. */
function tpslIdOf(quote: UnifiedQuote): bigint | undefined {
  if (quote.quoteId !== undefined) return quote.quoteId;
  if (quote.tempQuoteId !== undefined) return BigInt(quote.tempQuoteId);
  return undefined;
}

/** Case-insensitive address dedupe that preserves first-seen order. */
function dedupeAddresses(addresses: readonly (Address | undefined)[]): Address[] {
  const seen = new Set<string>();
  const unique: Address[] = [];
  for (const address of addresses) {
    if (!address) continue;
    const normalized = address.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(address);
  }
  return unique;
}
