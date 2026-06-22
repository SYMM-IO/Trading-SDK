import type { Address, Hex } from "viem";
import type { OrderType, PositionType, QuoteStatus } from "../../symmio-contracts/symmio/types";

/**
 * Close-type filter for quote history.
 *
 * Selects which terminal events a history read returns. Maps to the subgraph's
 * `QuoteEvent.type` values via {@link "closeTypeToEventTypes"}.
 */
export enum QuoteCloseType {
  /** Every close and liquidation event. */
  All = "All",
  /** Normal close (`FILL_CLOSE`). */
  Closed = "Closed",
  /** Force close (`FORCE_CLOSE`). */
  ForceClosed = "ForceClosed",
  /** Emergency close (`EMERGENCY_CLOSE`). */
  EmergencyClosed = "EmergencyClosed",
  /** Auto-deleveraging close (`ADL_CLOSE`). */
  AdlClosed = "AdlClosed",
  /** Liquidation (`LIQUIDATE_PARTY_A` / `_PARTY_B` / `_CLEARING_HOUSE`). */
  Liquidated = "Liquidated",
}

/**
 * Subgraph `QuoteEvent.type` values that terminate a (partial) position and
 * therefore appear in history. Each carries an immutable `metadata` snapshot.
 *
 * @remarks
 * Mirrors the event-type strings emitted by the SYMMIO subgraphs (v0.8.5+);
 * see the subgraphs `0.8.5_migration` doc — QuoteEvent metadata.
 */
export enum QuoteCloseEventType {
  /** A normal (partial or full) close. */
  FillClose = "FILL_CLOSE",
  /** A force close. */
  ForceClose = "FORCE_CLOSE",
  /** An emergency close. */
  EmergencyClose = "EMERGENCY_CLOSE",
  /** An auto-deleveraging close. */
  AdlClose = "ADL_CLOSE",
  /** Liquidation initiated against partyA. */
  LiquidatePartyA = "LIQUIDATE_PARTY_A",
  /** Liquidation initiated against partyB. */
  LiquidatePartyB = "LIQUIDATE_PARTY_B",
  /** Liquidation initiated by the clearing house. */
  LiquidateClearingHouse = "LIQUIDATE_CLEARING_HOUSE",
}

/**
 * One row of quote history — a single immutable `QuoteEvent` with its per-event
 * `metadata` snapshot overlaid onto the (otherwise mutable) quote it belongs to.
 *
 * Because the underlying `Quote` entity is mutable, a quote closed across several
 * partial closes produces several history rows that would otherwise show the same
 * final state. The snapshot overlay restores each event's own amount/price, so
 * every partial-close row is distinct.
 *
 * @remarks
 * Amounts and prices are raw `bigint` (18-decimal fixed point, no scaling),
 * matching the SDK's on-chain {@link "Quote"} reads. Enum fields are decoded.
 */
export interface QuoteHistoryRow {
  /** Stable id of the underlying immutable `QuoteEvent` (use as a row key). */
  eventId: string;
  /** The close / liquidation event that produced this row. */
  closeEventType: QuoteCloseEventType;
  /** Event block timestamp in seconds (the row's "close time"). */
  closedAt: number;
  /** Protocol quote id. */
  quoteId: bigint;
  /** Market identifier (`symbolId`). */
  marketId: number;
  /** Market ticker resolved by the subgraph, when known. */
  symbol: string | null;
  /** Long or short. */
  positionType: PositionType;
  /** Limit or market order (open side). */
  orderType: OrderType;
  /** Lifecycle status, forced to `CLOSED` / `LIQUIDATED` from the event type. */
  quoteStatus: QuoteStatus;
  /** Total quote quantity. */
  quantity: bigint;
  /** Open price (snapshot-overlaid when the event carried one). */
  openedPrice: bigint;
  /** Price partyA originally requested to open at. */
  requestedOpenPrice: bigint;
  /** Average close price (snapshot-overlaid with this event's close price). */
  avgClosedPrice: bigint;
  /** Amount closed by this event (snapshot `amount`). */
  closedAmount: bigint;
  /** Quantity of the close request this event settled. */
  quantityToClose: bigint;
  /** Liquidated amount (set only for liquidation rows). */
  liquidateAmount: bigint;
  /** Liquidation price (set only for liquidation rows). */
  liquidatePrice: bigint;
  /** PartyA (the SubAccount or Virtual Account that owns the quote). */
  partyA: Address;
  /** PartyB (the hedger/solver), or `null` when absent. */
  partyB: Address | null;
  /** The account-layer SubAccount address, or `null` when absent. */
  subAccount: Address | null;
  /** Block number of the event, when available. */
  blockNumber?: bigint;
  /** Transaction hash of the event, when available. */
  transaction?: Hex;
  /** Raw event `metadata` JSON string, preserved for power users. */
  rawMetadata: string | null;
}
