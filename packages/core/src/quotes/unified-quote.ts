import type { Address } from "viem";
import type { PendingInstantClose } from "../solvers/instant-close/get-instant-closes/to-pending-instant-close";
import type { PendingInstantOpen } from "../solvers/instant-open/get-instant-opens/to-pending-instant-open";
import type { LockedValues, OrderType, PositionType, Quote, QuoteStatus } from "../symmio-contracts/symmio/types";

/**
 * Where a {@link UnifiedQuote} was sourced from before reconciliation.
 *
 * - `"onchain"` — read from the SYMMIO core (`getPartyAOpenPositions` /
 *   `getPartyAPendingQuotes` + `getQuote`); the row carries a real `quoteId`.
 * - `"offchain"` — only known to a hedger so far (a pending instant-open or
 *   instant-close); the row carries a `tempQuoteId` and waits to anchor on-chain.
 */
export type QuoteOrigin = "onchain" | "offchain";

/**
 * The stage of a quote's lifecycle as tracked across the on-chain + off-chain
 * merge. Drives row styling and polling acceleration in the consumer.
 *
 * The off-chain stages (`OPTIMISTIC`, `PRICE_FILLED`) and the transient `CLOSING`
 * stage are SDK-side overlays — they do not exist on the on-chain
 * {@link QuoteStatus}; reconciliation assigns them from notifications and hedger
 * records.
 */
export enum QuoteLifecycle {
  /** Submitted to a hedger; no on-chain quote and no fill report yet. */
  OPTIMISTIC = "optimistic",
  /** A hedger reported a fill price (`InstantRFQ` success) but the on-chain quote has not landed yet. */
  PRICE_FILLED = "price-filled",
  /** Anchored on-chain; mirrors a real {@link QuoteStatus}. */
  ONCHAIN = "onchain",
  /** A close request is in flight (pending instant-close or `CLOSE_PENDING`). */
  CLOSING = "closing",
  /** The position is fully closed. */
  CLOSED = "closed",
  /** A hedger or notification reported the open/close failed. */
  FAILED = "failed",
}

/**
 * A single quote/position row merged from every source (on-chain reads, pending
 * instant-opens, pending instant-closes, and notifications) into one stable,
 * de-duplicated shape.
 *
 * All amount and price fields are 18-decimal-wei `bigint`, matching the on-chain
 * {@link Quote}. Off-chain hedger amounts are normalized to wei before they reach
 * this type. The `key` is a stable identity for React lists and the removal
 * ledger; `raw` carries the untouched source rows for advanced use.
 */
export interface UnifiedQuote {
  /** Stable identity for this row (`onchain:<id>` or `temp:<tempId>`). */
  key: string;
  /** Source the row was reconciled from. */
  origin: QuoteOrigin;
  /** Current lifecycle stage. */
  lifecycle: QuoteLifecycle;
  /** On-chain quote id, once anchored. */
  quoteId?: bigint;
  /** Hedger-local temp id, before the on-chain id exists. */
  tempQuoteId?: number;
  /** Sub-account (partyA) that owns the row. */
  partyA: Address;
  /** PartyB (hedger/solver) that locked/opened the quote, when known. */
  partyB?: Address;
  /** Solver-assigned Virtual Account address (lowcap), when known. */
  vaAddress?: Address;
  /** Market identifier (`symbolId`). */
  symbolId: bigint;
  /** Long or short. */
  positionType: PositionType;
  /** Limit or market order. */
  orderType: OrderType;
  /** On-chain status, when the row is anchored on-chain. */
  quoteStatus?: QuoteStatus;
  /** Price partyA requested to open at (wei). */
  requestedOpenPrice: bigint;
  /** Price partyB actually opened at (wei), when known. */
  openedPrice?: bigint;
  /** Average price the position closed at (wei), when known. */
  closedPrice?: bigint;
  /** Total requested quantity (wei). */
  quantity: bigint;
  /** Quantity already closed (wei), when known. */
  closedAmount?: bigint;
  /** Quantity targeted by a pending close (wei), when closing. */
  quantityToClose?: bigint;
  /** Margin locked against the row (wei). */
  lockedValues: LockedValues;
  /** Block timestamp the quote was created, when known. */
  createTimestamp?: bigint;
  /** Block timestamp of the last status change (sort key), when known. */
  statusModifyTimestamp?: bigint;
  /** Untouched source rows this was reconciled from. */
  raw: {
    /** The on-chain quote, when the row is anchored. */
    onchain?: Quote;
    /** The pending instant-open record, when sourced off-chain. */
    instantOpen?: PendingInstantOpen;
    /** The pending instant-close record, when closing off-chain. */
    instantClose?: PendingInstantClose;
  };
}
