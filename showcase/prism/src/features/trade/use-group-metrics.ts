"use client";

import type { PrismMarket } from "@/features/markets/types";
import { useMarkTick } from "@/features/prices/price-provider";
import { aggregateGroupUpnl, decimalPriceToWei } from "@symmio/trading-core";
import { useMemo } from "react";
import { formatUnits } from "viem";
import type { PrismGroup } from "./positions-provider";

/** Decimals every `UnifiedQuote` amount and every folded metric is denominated in. */
const WEI_DECIMALS = 18;

export interface GroupMetrics {
  /** Live mark for the group's market. `undefined` until its feed ticks. */
  mark?: number;
  /** Aggregated open size across the group's children. */
  size: number;
  /** `size` valued at the mark, falling back to the group's own entry. */
  notional: number;
  /**
   * Quantity-weighted average open price. `undefined` while any child is still
   * waiting for a settled fill — an average over a half-known group is a guess.
   */
  entryPrice?: number;
  /** Aggregated unrealized P&L in dollars, or `undefined` when nothing could be valued. */
  upnl?: number;
  /** Aggregated return on the margin behind the group, in percent. */
  upnlPercent?: number;
  /**
   * `false` when at least one child could not be valued, so `upnl` covers only
   * part of the group. The row says so rather than presenting a partial total as
   * the whole.
   */
  isComplete: boolean;
  /** Children left out of `upnl` because their open price has not settled. */
  unvaluedCount: number;
  /** Blended opening leverage across the group. `0` when nothing is locked. */
  leverage: number;
}

/**
 * What one grouped position is worth right now, priced on **its own** deployment.
 *
 * The per-quote twin of this, `useQuoteMetrics`, exists for the same reason and
 * carries the same warning: the SDK's own PnL hooks resolve their price feed
 * from the *connected* chain, and Prism shows two deployments side by side while
 * the wallet can only sit on one. So the mark is pinned to the group's market
 * family and handed to `aggregateGroupUpnl`, which is the exact-`bigint` fold the
 * SDK ships for this.
 *
 * The fold is deliberately not a sum of the children's displayed percentages.
 * `upnlPercent` divides the group's total P&L by its total open margin — the
 * return the trader actually earned on deployed capital — which is only the same
 * number as a per-child mean when every child shares one leverage. The screenshot
 * case (a 1× and a 2× leg on the same market) is precisely where those two
 * answers diverge.
 */
export function useGroupMetrics(row: PrismGroup, market?: PrismMarket): GroupMetrics {
  const tick = useMarkTick(row.family, market?.market.name ?? "");
  const markPrice = tick?.markPrice;

  return useMemo(() => {
    const { metrics, quotes } = row.group;

    const size = Number(formatUnits(metrics.openQuantity, WEI_DECIMALS));
    const entryPrice =
      metrics.weightedOpenPrice === undefined
        ? undefined
        : Number(formatUnits(metrics.weightedOpenPrice, WEI_DECIMALS));
    const leverage = metrics.leverage === undefined ? 0 : Number(formatUnits(metrics.leverage, WEI_DECIMALS));

    /* `decimalPriceToWei` rather than a `Number` hop: a lowcap mark lands around
       1e-7, and the fold is exact-bigint arithmetic that a float round-trip
       would quietly coarsen. It also returns `undefined` instead of fabricating
       a `0n`, which the fold would read as a real total loss. */
    const markWei = markPrice === undefined ? undefined : decimalPriceToWei(markPrice);
    /* The display copy of the same tick. Only the exact one reaches the fold. */
    const mark = markPrice === undefined ? undefined : Number(markPrice);
    const priced = mark !== undefined && Number.isFinite(mark) ? mark : undefined;

    const upnl = aggregateGroupUpnl(quotes, markWei);

    const base: GroupMetrics = {
      mark: priced,
      size,
      notional: size * (priced ?? entryPrice ?? 0),
      entryPrice,
      isComplete: upnl.isComplete,
      unvaluedCount: upnl.unvaluedCount,
      leverage,
    };

    /* Nothing valued is "P&L unknown", not "flat" — the same distinction the
       per-quote row draws, and the reason this is `undefined` and not `0`. */
    if (upnl.valuedCount === 0) return base;

    return {
      ...base,
      upnl: Number(formatUnits(upnl.upnl, WEI_DECIMALS)),
      upnlPercent: upnl.upnlPercent === undefined ? undefined : Number(formatUnits(upnl.upnlPercent, WEI_DECIMALS)),
    };
  }, [row.group, markPrice]);
}
