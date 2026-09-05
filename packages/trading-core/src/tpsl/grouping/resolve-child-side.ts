import type { TpSlConditionalOrderType, TpSlInfoState, TpSlPriceType } from "../types";
import type { GroupTpSlChild, GroupTpSlDesiredMap } from "./types";

/** Short side selector used across the grouped helpers. */
export type GroupTpSlSideKey = "tp" | "sl";

/** One child's side after the caller's pending edits are layered on the confirmed snapshot. */
export interface ResolvedChildSide {
  /** Which side this is. */
  side: GroupTpSlSideKey;
  /** The handler's wire name for the side. */
  conditionalOrderType: TpSlConditionalOrderType;
  /** Effective trigger price (decimal string). `""` means the side is unset or being cleared. */
  triggerPrice: string;
  /** Effective price type. Falls back to the confirmed one when the edit omits it. */
  priceType: TpSlPriceType;
  /** Trigger price the handler currently holds (decimal string). `""` when there is no order. */
  confirmedPrice: string;
  /** Price type the handler currently holds. */
  confirmedPriceType: TpSlPriceType;
  /** Lifecycle of the confirmed order. */
  state: TpSlInfoState;
  /** Handler-issued conditional-order id, when the handler holds a live order. */
  cohQuoteId?: string;
  /** `true` when a pending edit supplied the effective value. */
  isOverridden: boolean;
  /** `true` while the side is mid-flight (`"pending"` / `"confirming"`). */
  isPending: boolean;
}

/** The two sides in display order — TP always precedes SL. */
export const GROUP_TPSL_SIDES: readonly GroupTpSlSideKey[] = ["tp", "sl"];

/**
 * Layer a caller's pending edit over a child's confirmed TP/SL snapshot.
 *
 * This is the single place the override rule lives, so the summary, the order
 * list, the return estimate and the planner all agree on what a side currently
 * "is": an edit wins over the snapshot, an edit with an empty `triggerPrice`
 * clears the side, and an absent edit leaves the snapshot untouched.
 *
 * @param child - The child to resolve a side for.
 * @param side - `"tp"` or `"sl"`.
 * @param overrides - Pending per-child edits, keyed by `GroupTpSlChild.key`.
 * @returns The effective and confirmed view of that side.
 */
export function resolveChildSide(
  child: GroupTpSlChild,
  side: GroupTpSlSideKey,
  overrides?: GroupTpSlDesiredMap,
): ResolvedChildSide {
  const confirmedPrice = side === "tp" ? child.tpsl.tp : child.tpsl.sl;
  const confirmedPriceType = side === "tp" ? child.tpsl.tpPriceType : child.tpsl.slPriceType;
  const state = side === "tp" ? child.tpsl.tpState : child.tpsl.slState;
  const cohQuoteId = side === "tp" ? child.tpsl.tpCohQuoteId : child.tpsl.slCohQuoteId;
  const desired = overrides?.[child.key]?.[side];

  return {
    side,
    conditionalOrderType: side === "tp" ? "take_profit" : "stop_loss",
    triggerPrice: desired ? desired.triggerPrice.trim() : confirmedPrice,
    priceType: desired?.priceType ?? confirmedPriceType,
    confirmedPrice,
    confirmedPriceType,
    state,
    cohQuoteId,
    isOverridden: desired !== undefined,
    isPending: state === "pending" || state === "confirming",
  };
}
