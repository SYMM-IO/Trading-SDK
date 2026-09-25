import {
  getQuoteTpSl,
  getTpSlConfigQueryOptions,
  SymmApiError,
  watchTpSlNotifications,
  type Config,
  type QuoteTpSl,
  type QuoteTpSlRow,
  type TpSlInfoState,
  type TpSlPriceType,
  type UnifiedQuote,
} from "@symmio/trading-core";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import type { Address } from "viem";
import { cohWalletAddress } from "./chain.js";
import { useSdkScope } from "./use-sdk-scope.js";
import { useSubAccount } from "./use-sub-accounts.js";

/** React-Query scope for every conditional-order read — invalidated as one. */
export const TPSL_QUERY_KEY = "quote-tpsl";

/** Read the handler's live distance and TP/SL spread rules for the active deployment. */
export function useTpSlConfig(enabled = true) {
  const { config, chainId } = useSdkScope();
  return useQuery(getTpSlConfigQueryOptions(config, { chainId, query: { enabled } }));
}

/**
 * The id the handler indexes a quote's conditional orders under: the on-chain
 * `quoteId` once anchored, otherwise the hedger's (negative) `tempQuoteId`, so
 * TP/SL attached during the pre-chain window is readable straight away.
 */
function tpSlQuoteId(quote: UnifiedQuote): bigint | undefined {
  if (quote.quoteId != null && quote.quoteId !== 0n) return quote.quoteId;
  if (quote.tempQuoteId != null && quote.tempQuoteId !== 0) return BigInt(quote.tempQuoteId);
  return undefined;
}

/**
 * Fold the handler's per-conditional-order rows into one snapshot per quote:
 * for each side the most recently modified live row wins, and terminated rows
 * (`canceled`, `killed`) are dropped — a side with no live row reads as an
 * empty price, which the UI renders as "no order".
 *
 * `core` deliberately returns the raw rows so consumers can apply their own
 * selection rules; `@symmio/trading-react` folds them in its TP/SL store. This
 * is the core-direct equivalent of that fold.
 */
export function foldQuoteTpSl(rows: QuoteTpSlRow[] | undefined): QuoteTpSl {
  const snapshot: QuoteTpSl = {
    tp: "",
    sl: "",
    tpOpenPrice: "",
    slOpenPrice: "",
    tpPriceType: "markPrice",
    slPriceType: "markPrice",
    tpState: "canceled",
    slState: "canceled",
  };
  let tpModifyTime = -Infinity;
  let slModifyTime = -Infinity;

  for (const row of rows ?? []) {
    const state = liveRowState(row.state);
    if (!state) continue;
    const priceType: TpSlPriceType = row.action_price_type === "last_close" ? "lastPrice" : "markPrice";
    const triggerPrice = numberToString(row.conditional_order_price);
    const openPrice = row.price != null ? numberToString(row.price) : "";

    if (row.conditional_order_type === "take_profit") {
      if (row.modify_time <= tpModifyTime) continue;
      tpModifyTime = row.modify_time;
      snapshot.tp = triggerPrice;
      snapshot.tpOpenPrice = openPrice;
      snapshot.tpPriceType = priceType;
      snapshot.tpCohQuoteId = row.coh_quote_id;
      snapshot.tpState = state;
    } else if (row.conditional_order_type === "stop_loss") {
      if (row.modify_time <= slModifyTime) continue;
      slModifyTime = row.modify_time;
      snapshot.sl = triggerPrice;
      snapshot.slOpenPrice = openPrice;
      snapshot.slPriceType = priceType;
      snapshot.slCohQuoteId = row.coh_quote_id;
      snapshot.slState = state;
    }
  }

  return snapshot;
}

/** Map a handler row state onto the SDK's state, or `null` when terminated. */
function liveRowState(state: QuoteTpSlRow["state"]): TpSlInfoState | null {
  switch (state) {
    case "new":
      return "new";
    case "pending":
      return "pending";
    case "triggered":
    case "triggered_pending":
      return "triggered";
    default:
      return null;
  }
}

/** Stringify a wire price without letting tiny values render as `1e-7`. */
function numberToString(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

/**
 * The handler answers `404 Not found` for a quote it holds no conditional
 * orders for — the common case for a position without TP/SL. That is an empty
 * row set, not a failure: surfacing it as a query error would retry the miss on
 * every poll for every unprotected position.
 */
async function readQuoteTpSl(config: Config, chainId: number, quoteId: bigint): Promise<QuoteTpSlRow[]> {
  try {
    return await getQuoteTpSl(config, { chainId, quoteId });
  } catch (err) {
    if (err instanceof SymmApiError && err.status === 404) return [];
    throw err;
  }
}

/**
 * Read the live TP/SL snapshot for a set of quotes, keyed by
 * `UnifiedQuote.key`. Each quote's conditional orders are fetched from the
 * handler and folded to one snapshot per side; the account's TP/SL socket
 * invalidates the reads so a trigger set, filled, or cancelled elsewhere lands
 * without waiting for the poll.
 *
 * A key is absent until its first read resolves, and stays absent on chains
 * with no conditional-order handler configured.
 */
export function useQuotesTpSl(quotes: readonly UnifiedQuote[]): Map<string, QuoteTpSl> {
  const { config, chainId, solverId } = useSdkScope();
  const queryClient = useQueryClient();
  const { subAccount } = useSubAccount();
  const configured = cohWalletAddress(config, chainId, solverId) != null;

  const targets = useMemo(() => {
    const byKey = new Map<string, bigint>();
    for (const quote of quotes) {
      const quoteId = tpSlQuoteId(quote);
      if (quoteId !== undefined) byKey.set(quote.key, quoteId);
    }
    return [...byKey].map(([key, quoteId]) => ({ key, quoteId }));
  }, [quotes]);

  const results = useQueries({
    queries: targets.map(({ quoteId }) => ({
      queryKey: [TPSL_QUERY_KEY, chainId, quoteId.toString()],
      enabled: configured,
      queryFn: () => readQuoteTpSl(config, chainId, quoteId),
      staleTime: 5_000,
      refetchInterval: 20_000,
    })),
  });

  useEffect(() => {
    if (!configured || !subAccount) return;
    let unwatch: (() => void) | undefined;
    try {
      unwatch = watchTpSlNotifications(config, {
        account: subAccount as Address,
        chainId,
        /**
         * The frame carries only the side that moved, and the handler is the
         * authority on the rest of the row set — refetch rather than patch.
         */
        onNotification: () => void queryClient.invalidateQueries({ queryKey: [TPSL_QUERY_KEY] }),
      });
    } catch {
      /* No handler on this chain — the reads above are disabled too. */
    }
    return () => unwatch?.();
  }, [config, configured, queryClient, subAccount, chainId]);

  return useMemo(() => {
    const byQuoteKey = new Map<string, QuoteTpSl>();
    targets.forEach((target, index) => {
      const rows = results[index]?.data;
      if (rows) byQuoteKey.set(target.key, foldQuoteTpSl(rows));
    });
    return byQuoteKey;
  }, [targets, results]);
}

/** The live TP/SL snapshot for one quote. `undefined` until the read lands. */
export function useQuoteTpSl(quote: UnifiedQuote): QuoteTpSl | undefined {
  const quotes = useMemo(() => [quote], [quote]);
  return useQuotesTpSl(quotes).get(quote.key);
}
