import { GROUP_TPSL_SIDES, resolveChildSide } from "./resolve-child-side";
import type {
  GroupTpSlChild,
  GroupTpSlDeleteScope,
  GroupTpSlDeleteSkip,
  GroupTpSlDeleteTarget,
  PlanGroupTpSlDeleteResult,
} from "./types";

/**
 * Enumerate every cancellable TP/SL order across a grouped position — the
 * "cancel all" plan.
 *
 * Each target's `cohQuoteId` is read straight off the child's **confirmed**
 * snapshot, which the handler rows and the TP/SL WebSocket keep current. A side
 * that is still `"pending"` / `"confirming"` is excluded (cancelling it would
 * race the handler), and so is a side that only exists as a local edit.
 *
 * @param children - The grouped position's children.
 * @param scope - Both sides (default) or one.
 * @returns Cancellable targets plus typed skips.
 *
 * @example
 * ```ts
 * const plan = planGroupTpSlDelete(children, "stop_loss");
 * for (const target of plan.targets) {
 *   await deleteQuoteTpSl(config, { ...target });
 * }
 * ```
 */
export function planGroupTpSlDelete(
  children: readonly GroupTpSlChild[],
  scope: GroupTpSlDeleteScope = "all",
): PlanGroupTpSlDeleteResult {
  const targets: GroupTpSlDeleteTarget[] = [];
  const skipped: GroupTpSlDeleteSkip[] = [];

  for (const child of children) {
    for (const side of GROUP_TPSL_SIDES) {
      const resolved = resolveChildSide(child, side);
      if (scope !== "all" && scope !== resolved.conditionalOrderType) continue;
      if (!resolved.confirmedPrice) continue;

      if (resolved.isPending) {
        skipped.push({ key: child.key, conditionalOrderType: resolved.conditionalOrderType, reason: "in-flight" });
        continue;
      }
      if (!resolved.cohQuoteId) {
        skipped.push({ key: child.key, conditionalOrderType: resolved.conditionalOrderType, reason: "no-coh-id" });
        continue;
      }
      if (child.quoteId === undefined || child.virtualAccount === undefined) {
        skipped.push({ key: child.key, conditionalOrderType: resolved.conditionalOrderType, reason: "not-anchored" });
        continue;
      }

      targets.push({
        key: child.key,
        quoteId: child.quoteId,
        virtualAccount: child.virtualAccount,
        cohQuoteId: resolved.cohQuoteId,
        conditionalOrderType: resolved.conditionalOrderType,
        triggerPrice: resolved.confirmedPrice,
      });
    }
  }

  return { targets, skipped, isNoop: targets.length === 0 };
}
