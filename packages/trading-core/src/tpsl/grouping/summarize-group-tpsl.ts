import { sharePercent } from "../../shared/utils/percent";
import { childNotional } from "./notional";
import { resolveChildSide, type GroupTpSlSideKey } from "./resolve-child-side";
import type {
  GroupTpSlChild,
  GroupTpSlDesiredMap,
  GroupTpSlSideDisplay,
  GroupTpSlSideSummary,
  QuoteGroupTpSlSummary,
} from "./types";

/** Options for {@link summarizeQuoteGroupTpSl}. */
export interface SummarizeQuoteGroupTpSlOptions {
  /**
   * Pending per-child edits that win over the confirmed snapshot, keyed by
   * `GroupTpSlChild.key`. An explicit `""` trigger price clears that side.
   *
   * Omit for the confirmed-only view (the table cell); pass an editor's buffer
   * for a live coverage readout while the user types.
   */
  overrides?: GroupTpSlDesiredMap;
}

/**
 * Fold a grouped position's children into one {@link QuoteGroupTpSlSummary} —
 * per-side counts, the uniform-vs-mixed display state, and notional-weighted
 * coverage — in a single pass.
 *
 * A side is `"uniform"` only when **every** child carries a trigger and every
 * trigger price *and* price type is identical; otherwise it is `"mixed"` (or
 * `"none"` when no child carries one). Coverage is notional-weighted rather
 * than count-weighted: `Σ coveredNotional / Σ totalNotional × 100`, where a
 * child's notional is `openQuantity × openPrice`. All bigint — no float drift.
 *
 * Pure and order-independent.
 *
 * @param children - The grouped position's children.
 * @param options - Optional pending edits to layer over the snapshots.
 * @returns The folded summary.
 *
 * @example
 * ```ts
 * const summary = summarizeQuoteGroupTpSl(children);
 * if (summary.isEmpty) return "Not set";
 * if (summary.takeProfit.display === "uniform") return summary.takeProfit.price;
 * return `${summary.takeProfit.count} TP`;
 * ```
 */
export function summarizeQuoteGroupTpSl(
  children: readonly GroupTpSlChild[],
  options: SummarizeQuoteGroupTpSlOptions = {},
): QuoteGroupTpSlSummary {
  let totalNotional = 0n;
  for (const child of children) totalNotional += childNotional(child);

  const takeProfit = summarizeSide(children, "tp", totalNotional, options.overrides);
  const stopLoss = summarizeSide(children, "sl", totalNotional, options.overrides);

  return {
    childCount: children.length,
    totalNotional,
    takeProfit,
    stopLoss,
    isEmpty: takeProfit.count === 0 && stopLoss.count === 0,
  };
}

/** Fold one side across every child. */
function summarizeSide(
  children: readonly GroupTpSlChild[],
  side: GroupTpSlSideKey,
  totalNotional: bigint,
  overrides?: GroupTpSlDesiredMap,
): GroupTpSlSideSummary {
  let count = 0;
  let coveredNotional = 0n;
  let isPending = false;
  let price: string | undefined;
  let priceType = children.length > 0 ? resolveChildSide(children[0]!, side, overrides).priceType : undefined;
  let allIdentical = true;

  for (const child of children) {
    const resolved = resolveChildSide(child, side, overrides);
    if (resolved.isPending) isPending = true;
    if (!resolved.triggerPrice) {
      allIdentical = false;
      continue;
    }
    count += 1;
    coveredNotional += childNotional(child);
    if (price === undefined) {
      price = resolved.triggerPrice;
      priceType = resolved.priceType;
    } else if (price !== resolved.triggerPrice || priceType !== resolved.priceType) {
      allIdentical = false;
    }
  }

  const display: GroupTpSlSideDisplay = count === 0 ? "none" : allIdentical ? "uniform" : "mixed";

  return {
    display,
    count,
    total: children.length,
    price: display === "uniform" ? price : undefined,
    priceType: display === "uniform" ? priceType : undefined,
    isPending,
    coveredNotional,
    coveragePercent: sharePercent(coveredNotional, totalNotional),
  };
}
