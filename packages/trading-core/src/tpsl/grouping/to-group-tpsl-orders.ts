import { sharePercent } from "../../shared/utils/percent";
import { childNotional } from "./notional";
import { GROUP_TPSL_SIDES, resolveChildSide } from "./resolve-child-side";
import type { GroupTpSlChild, GroupTpSlDesiredMap, GroupTpSlOrder } from "./types";

/** Options for {@link toGroupTpSlOrders}. */
export interface ToGroupTpSlOrdersOptions {
  /** Pending per-child edits that win over the confirmed snapshot. */
  overrides?: GroupTpSlDesiredMap;
}

/**
 * Flatten a grouped position's children into one row per live-or-desired TP/SL
 * order — the data behind an overview list where each order can be inspected or
 * cancelled individually.
 *
 * TP precedes SL within a child; children keep input order. `sizePercent` is
 * the child's share of the group's **total** open notional (not of the covered
 * notional), so a partially covered group's rows sum to less than 100%.
 *
 * @param children - The grouped position's children.
 * @param options - Optional pending edits to layer over the snapshots.
 * @returns One {@link GroupTpSlOrder} per side that carries a trigger.
 */
export function toGroupTpSlOrders(
  children: readonly GroupTpSlChild[],
  options: ToGroupTpSlOrdersOptions = {},
): GroupTpSlOrder[] {
  let totalNotional = 0n;

  for (const child of children) totalNotional += childNotional(child);

  const orders: GroupTpSlOrder[] = [];
  for (const child of children) {
    const notional = childNotional(child);
    for (const side of GROUP_TPSL_SIDES) {
      const resolved = resolveChildSide(child, side, options.overrides);
      if (!resolved.triggerPrice) continue;
      orders.push({
        key: child.key,
        quoteId: child.quoteId,
        conditionalOrderType: resolved.conditionalOrderType,
        triggerPrice: resolved.triggerPrice,
        priceType: resolved.priceType,
        sizePercent: sharePercent(notional, totalNotional) ?? 0n,
        sizeNotional: notional,
        state: resolved.state,
        isPending: resolved.isPending,
        hasLiveOrder: Boolean(resolved.cohQuoteId),
        cohQuoteId: resolved.cohQuoteId,
      });
    }
  }
  return orders;
}
