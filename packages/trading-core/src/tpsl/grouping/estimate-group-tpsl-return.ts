import { sharePercent } from "../../shared/utils/percent";
import { WEI } from "../../shared/utils/wei";
import { PositionType } from "../../symmio-contracts/symmio/types";
import type { TpSlConditionalOrderType } from "../types";
import { childNotional, triggerPriceToWei } from "./notional";
import { resolveChildSide } from "./resolve-child-side";
import type { GroupTpSlChild, GroupTpSlDesiredMap, GroupTpSlReturnEstimate, GroupTpSlReturnLeg } from "./types";

/** Parameters for {@link estimateGroupTpSlReturn}. */
export interface EstimateGroupTpSlReturnParameters {
  /** Which side to estimate. */
  conditionalOrderType: TpSlConditionalOrderType;
  /** Pending per-child edits that win over the confirmed snapshot. */
  overrides?: GroupTpSlDesiredMap;
}

/**
 * Estimate a grouped position's return if every child's take-profit (or
 * stop-loss) triggers at its target.
 *
 * Per child: `pnl = openQuantity × (triggerPrice − openPrice)`, negated for a
 * `SHORT`. **Leverage deliberately does not appear** — it multiplies one factor
 * and divides the other, so it cancels algebraically; carrying it would only
 * add a divide-by-zero hazard. Children with no trigger on the requested side
 * contribute nothing.
 *
 * All bigint, 18-decimal wei. Pure and order-independent.
 *
 * @param children - The grouped position's children.
 * @param parameters - Side to estimate, plus optional pending edits.
 * @returns Signed totals plus the per-child breakdown.
 *
 * @example
 * ```ts
 * const { totalPnl, returnPercent } = estimateGroupTpSlReturn(children, {
 *   conditionalOrderType: "take_profit",
 *   overrides: editor.desired,
 * });
 * ```
 */
export function estimateGroupTpSlReturn(
  children: readonly GroupTpSlChild[],
  parameters: EstimateGroupTpSlReturnParameters,
): GroupTpSlReturnEstimate {
  const side = parameters.conditionalOrderType === "take_profit" ? "tp" : "sl";
  const legs: GroupTpSlReturnLeg[] = [];
  let totalPnl = 0n;
  let totalNotional = 0n;

  for (const child of children) {
    const resolved = resolveChildSide(child, side, parameters.overrides);
    if (!resolved.triggerPrice) continue;

    const triggerPrice = triggerPriceToWei(resolved.triggerPrice);
    const delta = triggerPrice - child.openPrice;
    const signed = child.positionType === PositionType.SHORT ? -delta : delta;
    const pnl = (child.openQuantity * signed) / WEI;
    const notional = childNotional(child);

    legs.push({ key: child.key, triggerPrice: resolved.triggerPrice, pnl, notional });
    totalPnl += pnl;
    totalNotional += notional;
  }

  return { totalPnl, totalNotional, returnPercent: sharePercent(totalPnl, totalNotional), legs };
}
