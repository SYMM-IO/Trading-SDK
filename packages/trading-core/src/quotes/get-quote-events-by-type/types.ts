import type { Hex } from "viem";

/**
 * Subgraph `QuoteEvent.type` values for non-terminal events that touch a quote's
 * open price or funding. Terminal close/liquidation events live on
 * {@link "QuoteCloseEventType"} (see `getQuoteHistory`).
 */
export enum QuoteEventType {
  /** Open-price recompute on a partial close (settle unrealized PnL). */
  SettleUpnl = "SETTLE_UPNL",
  /** Periodic funding-rate tick (carries a `rate` and the resulting paid/received). */
  ChargeFundingRate = "CHARGE_FUNDING_RATE",
  /** Catch-up charge of accumulated funding that was previously deferred. */
  ChargeAccumulatedFundingFee = "CHARGE_ACCUMULATED_FUNDING_FEE",
}

/**
 * Every event type that contributes to a quote's open-price history.
 *
 * Includes both explicit price-recompute events (`SETTLE_UPNL`) and funding-rate
 * charges (`CHARGE_FUNDING_RATE`, `CHARGE_ACCUMULATED_FUNDING_FEE`) — funding
 * ticks also adjust the open price as a side effect, so they belong in the same
 * timeline. Each row carries the {@link QuoteEventType} discriminant so the UI
 * can label and lay it out per type.
 */
export const PRICE_HISTORY_EVENT_TYPES: readonly QuoteEventType[] = [
  QuoteEventType.SettleUpnl,
  QuoteEventType.ChargeFundingRate,
  QuoteEventType.ChargeAccumulatedFundingFee,
];

/**
 * Every event type that settles funding on a quote — the per-tick rows behind a
 * position's funding history.
 *
 * A subset of {@link PRICE_HISTORY_EVENT_TYPES}: it drops `SETTLE_UPNL` (an
 * open-price recompute that moves no funding) and keeps only the two charge
 * events, each of which carries `fundingPaid` / `fundingReceived` / `rate` in its
 * metadata. Pair with `getQuotesEventsByType` for a whole {@link QuoteGroup}.
 */
export const FUNDING_HISTORY_EVENT_TYPES: readonly QuoteEventType[] = [
  QuoteEventType.ChargeFundingRate,
  QuoteEventType.ChargeAccumulatedFundingFee,
];

/**
 * One decoded `QuoteEvent` row. `type` identifies which event family this row
 * belongs to (price update vs funding charge); the decoded metadata fields are
 * present whenever the underlying JSON carried them.
 *
 * All amount and price fields are 18-decimal-wei `bigint`.
 */
export interface QuoteEventRow {
  /** Subgraph `QuoteEvent.id` (stable; use as the React key). */
  eventId: string;
  /** On-chain quote id this row belongs to. */
  quoteId: bigint;
  /** Event-type discriminant — tells the UI which fields it cares about. */
  type: QuoteEventType;
  /** Event block timestamp in seconds. */
  timestamp: number;
  /** Block number, when available. */
  blockNumber?: bigint;
  /** Transaction hash, when available. */
  transaction?: Hex;
  /** New open price after the event (wei), when present in metadata. */
  newPrice?: bigint;
  /** Open price before the event (wei), when present in metadata. */
  prevPrice?: bigint;
  /** Remaining open quantity at the event (wei), when present in metadata. */
  openQuantity?: bigint;
  /** Funding partyA paid in this event (wei), when present in metadata. */
  fundingPaid?: bigint;
  /** Funding partyA received in this event (wei), when present in metadata. */
  fundingReceived?: bigint;
  /** Funding rate applied for the tick (signed `int256` as wei), when present in metadata. */
  rate?: bigint;
  /** Raw metadata JSON string from the subgraph, preserved for power users. */
  rawMetadata: string | null;
}
