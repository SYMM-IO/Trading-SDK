import type { Address } from "viem";
import type { SubAccountIsolationType } from "../../symmio-contracts/account-layer/types";
import type { LockedValues, PositionType } from "../../symmio-contracts/symmio/types";
import type { UnifiedQuote } from "../unified-quote";

/**
 * The dimensions a {@link QuoteGroup} is keyed on. Only the fields the active
 * strategy groups by are set:
 *
 * - `MARKET_DIRECTION` → `{ symbolId, positionType }`
 * - `MARKET` → `{ symbolId }`
 * - `POSITION` / `CUSTOM` (per-quote) → `{ symbolId, positionType, vaAddress }`
 *   (the single quote's full identity)
 *
 * A custom `keyOf` may set whichever subset it groups on.
 */
export interface QuoteGroupBy {
  /** Market the group covers, when grouped by market. */
  symbolId?: bigint;
  /** Trade side the group covers, when grouped by direction. */
  positionType?: PositionType;
  /** Virtual Account the group covers, when grouped per single position. */
  vaAddress?: Address;
}

/**
 * A group's identity: a stable string `key` (for React lists and selection) plus
 * the structured {@link QuoteGroupBy} dimensions it was keyed on. Returned by a
 * {@link QuoteGroupKeyFn}.
 */
export interface QuoteGroupKey {
  /** Stable string identity, unique per group within one {@link groupQuotes} call. */
  key: string;
  /** The structured dimensions that identify this group. */
  by: QuoteGroupBy;
}

/**
 * Derives the group a quote belongs to. Built-in strategies provide one per
 * {@link SubAccountIsolationType}; a consumer supplies their own to group on any
 * dimension (e.g. by `vaAddress`, or market + direction + VA).
 *
 * @param quote - The quote to place into a group.
 * @returns The group's stable key and structured dimensions.
 */
export type QuoteGroupKeyFn = (quote: UnifiedQuote) => QuoteGroupKey;

/**
 * How {@link groupQuotes} folds quotes into groups:
 *
 * - a {@link SubAccountIsolationType} selects the matching built-in strategy
 *   (`POSITION` and `CUSTOM` produce one group per quote; `MARKET` groups by
 *   market; `MARKET_DIRECTION` groups by market + side);
 * - `{ keyOf }` lets the consumer group on any dimension.
 *
 * Reusing the on-chain isolation enum keeps the UI grouping faithful to how the
 * AccountLayer actually allocates Virtual Accounts for the subaccount.
 */
export type QuoteGroupingStrategy = SubAccountIsolationType | { readonly keyOf: QuoteGroupKeyFn };

/**
 * Pure, price-independent aggregations over a group's child quotes. Every amount
 * is 18-decimal wei `bigint`, matching {@link UnifiedQuote}.
 *
 * Metrics that need a live mark price or Virtual Account balance are
 * intentionally **not** here — they take those inputs explicitly instead:
 * `aggregateGroupUpnl` (unrealized PnL at a mark price), `calculateMarginRisk`
 * (margin, equity and liquidation buffer from an account's balance), and
 * `calculateLiquidationPrice` (the price liquidation happens at).
 */
export interface QuoteGroupMetrics {
  /** Number of child quotes in the group. */
  quoteCount: number;
  /** Children classified as active positions (see `isActivePosition`). */
  openCount: number;
  /** Children classified as resting/pending orders (see `isPendingOrder`). */
  pendingCount: number;
  /** Σ of each child's original `quantity` (pre-close), wei. */
  quantity: bigint;
  /** Σ of each child's open quantity (`quantity − closedAmount`) — the live aggregated size, wei. */
  openQuantity: bigint;
  /**
   * Quantity-weighted average open price across children (wei):
   * `Σ(openQuantity × price) / Σ openQuantity`, where `price` is `openedPrice`
   * when known, else `requestedOpenPrice`. `undefined` while the group has no open
   * size, or while any child still lacks a settled open price (a pending or
   * optimistic open) — render a loading state in that case.
   */
  weightedOpenPrice?: bigint;
  /**
   * Σ frozen at-open notional (`quantity × (initialOpenedPrice ?? requestedOpenPrice)`)
   * across children, wei. Partial closes do not shrink it.
   */
  initialNotional: bigint;
  /** Σ of each {@link LockedValues} leg (`cva`, `lf`, `partyAmm`, `partyBmm`) across children, wei. */
  lockedValues: LockedValues;
  /**
   * Blended opening leverage as an 18-decimal fixed-point `bigint` (e.g. `2.5x →
   * 2_500000000000000000n`): `Σ(quantity × (requestedOpenPrice ?? openedPrice)) /
   * Σ(cva + lf + partyAmm + partyBmm)`, each child using its frozen
   * `initialLockedValues` (else `lockedValues`). `undefined` when that locked
   * margin is `0` (nothing to leverage against).
   */
  leverage?: bigint;
}

/**
 * One grouped position: several {@link UnifiedQuote}s in the same market (and,
 * depending on strategy, the same side) folded into a single row with aggregated
 * {@link QuoteGroupMetrics}.
 *
 * The `quotes`, `by`, and stable `key` are the extension points for later
 * group-level actions (close-all, nuke, grouped TP/SL): those operate over
 * `quotes` and identify their target by `key` / `by`.
 */
export interface QuoteGroup {
  /** Stable string identity (React key + selection); unique within one {@link groupQuotes} call. */
  key: string;
  /** The dimensions that identify this group. */
  by: QuoteGroupBy;
  /**
   * The Virtual Account this group resolves to, taken from its first on-chain
   * child (falling back to any child that carries one). `undefined` while the
   * group is all-optimistic (no on-chain quote has anchored its VA yet).
   */
  vaAddress?: Address;
  /** Child quotes, newest first. */
  quotes: UnifiedQuote[];
  /** `true` when more than one quote folds into this group (the single-vs-aggregate render switch). */
  isAggregate: boolean;
  /** Pure aggregated metrics over {@link quotes}. */
  metrics: QuoteGroupMetrics;
}
