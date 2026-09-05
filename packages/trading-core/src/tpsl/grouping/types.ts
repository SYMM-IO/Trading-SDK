import type { Address } from "viem";
import type { PositionType } from "../../symmio-contracts/symmio/types";
import type { SetTpSlSide } from "../set-quote-tpsl/set-quote-tpsl";
import type { QuoteTpSl, TpSlConditionalOrderType, TpSlInfoState, TpSlPriceType, TpSlValidation } from "../types";

/**
 * One child position offered to the grouped TP/SL helpers: the quote's write
 * identity, the sizing/pricing inputs the math needs, and its current confirmed
 * TP/SL snapshot.
 *
 * Build these from a grouped position's child quotes with
 * {@link toGroupTpSlChildren}. Every amount and price is 18-decimal wei
 * `bigint`, matching `UnifiedQuote`; trigger prices inside `tpsl` stay decimal
 * strings, matching the handler.
 */
export interface GroupTpSlChild {
  /** Stable child identity (`UnifiedQuote.key`). */
  key: string;
  /**
   * On-chain quote id. `undefined` while the child is still off-chain — no
   * conditional order can be written against it yet.
   */
  quoteId?: bigint;
  /**
   * PartyA the conditional order is signed for: the child's Virtual Account
   * (`vaAddress ?? partyA`). `undefined` only when the quote carries neither.
   */
  virtualAccount?: Address;
  /** Market identifier (`symbolId`). */
  symbolId: bigint;
  /** Trade side. */
  positionType: PositionType;
  /** Remaining open size (`quantity − closedAmount`), wei — what a TP/SL leg would close. */
  openQuantity: bigint;
  /** Price the child is valued and diffed against (`openedPrice` when settled, else `requestedOpenPrice`), wei. */
  openPrice: bigint;
  /** The child's confirmed TP/SL snapshot. Both sides empty means "no orders". */
  tpsl: QuoteTpSl;
}

/**
 * A desired trigger for one side of one child.
 *
 * An **empty** `triggerPrice` means *clear this side* — the planner turns that
 * into a `delete` when the handler holds a live order, and drops it otherwise.
 */
export interface GroupTpSlDesiredSide {
  /** Trigger price (decimal string), or `""` to clear the side. */
  triggerPrice: string;
  /** Mark vs last-close. Defaults to the child's current price type when omitted. */
  priceType?: TpSlPriceType;
}

/** Desired TP and/or SL for one child. An omitted side is left untouched. */
export interface GroupTpSlDesiredSides {
  /** Take-profit target. */
  tp?: GroupTpSlDesiredSide;
  /** Stop-loss target. */
  sl?: GroupTpSlDesiredSide;
}

/**
 * Desired per-child state, keyed by {@link GroupTpSlChild["key"]}. A child with no
 * entry is left entirely untouched.
 */
export type GroupTpSlDesiredMap = Readonly<Record<string, GroupTpSlDesiredSides>>;

/**
 * How a grouped TP/SL cell should render one side:
 *
 * - `"none"` — no child carries an order (render "Not set");
 * - `"uniform"` — every child carries the **same** trigger price *and* price
 *   type (render the price itself);
 * - `"mixed"` — only some children carry one, or the values differ (render the
 *   count, e.g. `"2 TP"`).
 */
export type GroupTpSlSideDisplay = "none" | "uniform" | "mixed";

/** Folded state of one side (TP or SL) across a grouped position's children. */
export interface GroupTpSlSideSummary {
  /** How the cell should render this side. */
  display: GroupTpSlSideDisplay;
  /** Children carrying a trigger on this side. */
  count: number;
  /** Children folded over — the `count` denominator. */
  total: number;
  /** The shared trigger price (decimal string). Set only when `display` is `"uniform"`. */
  price?: string;
  /** The shared price type. Set only when `display` is `"uniform"`. */
  priceType?: TpSlPriceType;
  /** `true` while any child's side is mid-flight (`"pending"` or `"confirming"`). */
  isPending: boolean;
  /** Σ open notional of the covered children (`openQuantity × openPrice`), wei. */
  coveredNotional: bigint;
  /**
   * Notional-weighted coverage as an 18-decimal fixed-point percent
   * (`50% → 50_000000000000000000n`) — **not** a count ratio, so one large
   * uncovered child correctly drags coverage down. `undefined` when the group
   * has no open notional.
   */
  coveragePercent?: bigint;
}

/**
 * Folded TP/SL state of a whole grouped position — the data model behind both
 * the table cell and a modal's coverage footer. Produced by
 * {@link summarizeQuoteGroupTpSl}.
 */
export interface QuoteGroupTpSlSummary {
  /** Children the summary folded over. */
  childCount: number;
  /** Σ open notional across children, wei — the coverage denominator. */
  totalNotional: bigint;
  /** Take-profit side. */
  takeProfit: GroupTpSlSideSummary;
  /** Stop-loss side. */
  stopLoss: GroupTpSlSideSummary;
  /** `true` when neither side carries a single trigger — the "Not set" render branch. */
  isEmpty: boolean;
}

/** One TP or SL order row in a grouped position's overview list. */
export interface GroupTpSlOrder {
  /** Stable child identity. */
  key: string;
  /** On-chain quote id, when the child is anchored. */
  quoteId?: bigint;
  /** Which side this row is. */
  conditionalOrderType: TpSlConditionalOrderType;
  /** Trigger price (decimal string) — the desired value when overridden, else the confirmed one. */
  triggerPrice: string;
  /** Price type in force for this row. */
  priceType: TpSlPriceType;
  /** The child's share of the group's open notional, as an 18-decimal fixed-point percent. */
  sizePercent: bigint;
  /** The child's open notional (`openQuantity × openPrice`), wei. */
  sizeNotional: bigint;
  /**
   * Lifecycle of the side as the handler last reported it. A row that exists
   * only as a local edit reports the snapshot's state (`"canceled"` when there
   * is no server order) — branch on {@link hasLiveOrder}, not on this.
   */
  state: TpSlInfoState;
  /** `true` while the side is mid-flight (`"pending"` / `"confirming"`). */
  isPending: boolean;
  /** `true` when the handler already holds this order (a `cohQuoteId` exists). */
  hasLiveOrder: boolean;
  /** The handler-issued conditional-order id, when live — the delete target. */
  cohQuoteId?: string;
}

/** Per-child contribution to a grouped position's estimated return. */
export interface GroupTpSlReturnLeg {
  /** Stable child identity. */
  key: string;
  /** Trigger price the leg was estimated at (decimal string). */
  triggerPrice: string;
  /** Estimated PnL if the child closes at its trigger, wei (signed). */
  pnl: bigint;
  /** The child's open notional, wei. */
  notional: bigint;
}

/** Estimated group return if every contributing child's side triggers. */
export interface GroupTpSlReturnEstimate {
  /** Σ PnL across contributing children, wei (signed). */
  totalPnl: bigint;
  /** Σ open notional across contributing children, wei. */
  totalNotional: bigint;
  /**
   * `totalPnl / totalNotional × 100` as an 18-decimal fixed-point percent
   * (signed). `undefined` when no child contributes.
   */
  returnPercent?: bigint;
  /** Per-child breakdown, in input order. Only children with a trigger contribute. */
  legs: GroupTpSlReturnLeg[];
}

/** Why {@link planGroupTpSl} left a child alone. */
export type GroupTpSlSkipReason =
  /** Every desired side already matches the child's confirmed snapshot. */
  | "unchanged"
  /** The child has no desired entry, or nothing to write and nothing to remove. */
  | "nothing-to-do"
  /** Not anchored on-chain yet (no `quoteId`), or no Virtual Account resolved. */
  | "not-anchored"
  /** No open size left to attach a conditional order to. */
  | "no-open-quantity"
  /** The resulting TP/SL pair failed `validateTpSl`. */
  | "invalid";

/** What {@link planGroupTpSl} decided for one child. */
export type GroupTpSlAction =
  | {
      /** Submit a conditional order for this child. */
      action: "set";
      /** Stable child identity. */
      key: string;
      /** On-chain quote id — always present on a `set`. */
      quoteId: bigint;
      /** PartyA to sign the conditional order for. */
      virtualAccount: Address;
      /** Market identifier. */
      symbolId: bigint;
      /** Trade side. */
      positionType: PositionType;
      /** Quantity to stamp on each leg (decimal string, from `openQuantity`). */
      quantity: string;
      /** Take-profit leg — present only when the TP side actually changed. */
      tp?: SetTpSlSide;
      /** Stop-loss leg — present only when the SL side actually changed. */
      sl?: SetTpSlSide;
    }
  | {
      /** Cancel a live conditional order for this child. */
      action: "delete";
      /** Stable child identity. */
      key: string;
      /** On-chain quote id. */
      quoteId: bigint;
      /** PartyA to sign the delete for. */
      virtualAccount: Address;
      /** Handler-issued conditional-order id being cancelled. */
      cohQuoteId: string;
      /** Side being cancelled. */
      conditionalOrderType: TpSlConditionalOrderType;
    }
  | {
      /** Leave this child alone. */
      action: "skip";
      /** Stable child identity. */
      key: string;
      /** Why the child was skipped. */
      reason: GroupTpSlSkipReason;
      /** Per-side errors, when `reason` is `"invalid"`. */
      validation?: TpSlValidation;
    };

/**
 * Result of {@link planGroupTpSl}.
 *
 * Deliberately **not** a `{ feasible }` discriminated union like
 * `PlanGroupCloseResult`: a group close has one global constraint (the
 * allocation must sum to the target exactly, or nothing may be closed), whereas
 * TP/SL writes are independent per child — a plan is always producible and
 * validity is per-child. Gate the submit on {@link hasInvalid}.
 */
export interface PlanGroupTpSlResult {
  /** Every decision the planner made, in child order (a child may yield a delete *and* a set). */
  actions: GroupTpSlAction[];
  /** The `set` decisions, in submission order. */
  sets: Extract<GroupTpSlAction, { action: "set" }>[];
  /** The `delete` decisions, in submission order. */
  deletes: Extract<GroupTpSlAction, { action: "delete" }>[];
  /** The `skip` decisions, in child order. */
  skips: Extract<GroupTpSlAction, { action: "skip" }>[];
  /** `true` when at least one child failed validation — block the submit. */
  hasInvalid: boolean;
  /** `true` when nothing needs writing. */
  isNoop: boolean;
}

/** Scope of a grouped TP/SL cancel: both sides, or one. */
export type GroupTpSlDeleteScope = "all" | TpSlConditionalOrderType;

/** One cancellable order {@link planGroupTpSlDelete} found. */
export interface GroupTpSlDeleteTarget {
  /** Stable child identity. */
  key: string;
  /** On-chain quote id. */
  quoteId: bigint;
  /** PartyA to sign the delete for. */
  virtualAccount: Address;
  /** Handler-issued conditional-order id — the delete target. */
  cohQuoteId: string;
  /** Side being cancelled. */
  conditionalOrderType: TpSlConditionalOrderType;
  /** Trigger price of the order being cancelled (decimal string) — for confirmation UI. */
  triggerPrice: string;
}

/** A side {@link planGroupTpSlDelete} deliberately left alone. */
export interface GroupTpSlDeleteSkip {
  /** Stable child identity. */
  key: string;
  /** Side that was skipped. */
  conditionalOrderType: TpSlConditionalOrderType;
  /**
   * - `"in-flight"` — the side is `"pending"` / `"confirming"`; cancelling now
   *   would race the handler.
   * - `"no-coh-id"` — the side carries a value but no handler id, so there is
   *   nothing server-side to cancel (a local edit only).
   * - `"not-anchored"` — the child has no on-chain id or Virtual Account to
   *   sign the cancel against.
   */
  reason: "in-flight" | "no-coh-id" | "not-anchored";
}

/** Result of {@link planGroupTpSlDelete}. */
export interface PlanGroupTpSlDeleteResult {
  /** Cancellable orders — TP before SL within a child, children in input order. */
  targets: GroupTpSlDeleteTarget[];
  /** Sides deliberately excluded, with reasons. */
  skipped: GroupTpSlDeleteSkip[];
  /** `true` when there is nothing to cancel. */
  isNoop: boolean;
}
