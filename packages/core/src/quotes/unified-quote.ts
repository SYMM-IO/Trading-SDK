import type { Address, Hex } from "viem";
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
  /**
   * The open anchored on-chain per the notification (the `quoteId` is known), but
   * the on-chain read has not returned the quote struct yet. The row is being
   * "written on-chain": shown with its anchored id while the SDK waits for the RPC
   * to confirm it. Resolves to {@link QuoteLifecycle.ONCHAIN} once the on-chain
   * read returns the struct.
   */
  WRITE_ONCHAIN = "write-onchain",
  /** Anchored on-chain; mirrors a real {@link QuoteStatus}. */
  ONCHAIN = "onchain",
  /**
   * A close was just submitted and the hedger's pending-instant-close feed has it,
   * but no close notification has confirmed a price yet — the close-side analog of
   * {@link QuoteLifecycle.OPTIMISTIC}. Advances to {@link QuoteLifecycle.CLOSE_PRICE_FILLED}.
   */
  OPTIMISTIC_CLOSE = "optimistic-close",
  /**
   * A close notification reported the close price/fill request
   * (`InstantRequestToClosePosition`) — the close-side analog of
   * {@link QuoteLifecycle.PRICE_FILLED}. Advances to {@link QuoteLifecycle.WRITE_ONCHAIN_CLOSE}.
   */
  CLOSE_PRICE_FILLED = "close-price-filled",
  /**
   * The close fill (`FillMarketOrderInstantClose`) was reported, or a pending
   * instant-close overlays the row while the on-chain status still shows the
   * position open — the close is being "written on-chain", awaiting the RPC. The
   * close-side analog of {@link QuoteLifecycle.WRITE_ONCHAIN}. Resolves to
   * {@link QuoteLifecycle.CLOSING} when the on-chain status reflects the pending close.
   */
  WRITE_ONCHAIN_CLOSE = "write-onchain-close",
  /** The close is confirmed pending on-chain — on-chain `CLOSE_PENDING` / `CANCEL_CLOSE_PENDING`. */
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
  /** Initial price partyB opened at before any edits (wei), when known. */
  initialOpenedPrice?: bigint;
  /** Average price across executed closes (wei), when known. */
  avgClosedPrice?: bigint;
  /** Requested limit price for a pending close (wei), when known. */
  requestedClosePrice?: bigint;
  /** Market price snapshot at last state change (wei), when known. */
  marketPrice?: bigint;
  /** Total requested quantity (wei) — fixed for the life of the position; partial closes do not shrink it. */
  quantity: bigint;
  /** Quantity already closed (wei), when known. */
  closedAmount?: bigint;
  /**
   * Remaining **open** size (wei): `quantity − closedAmount`, the live quantity
   * still on the position (the figure a UI shows as "position size"); `0` once
   * fully closed. Derived from the other amount fields by {@link quoteOpenQuantity}.
   */
  openQuantity: bigint;
  /** Quantity targeted by a pending close (wei), when closing. */
  quantityToClose?: bigint;
  /** Margin locked against the row (wei). */
  lockedValues: LockedValues;
  /** Margin locked at open time — basis for leverage (wei), when known. */
  initialLockedValues?: LockedValues;
  /** Maximum funding rate partyA accepts, when known. */
  maxFundingRate?: bigint;
  /** Net funding paid (positive) or received (negative) over the position's life (wei), when known. */
  accumulatedPaidFunding?: bigint;
  /** Block timestamp funding was last applied, when known. */
  lastFundingPaymentTimestamp?: bigint;
  /** Quote deadline (expiry) timestamp, when known. */
  deadline?: bigint;
  /** Trading fee charged on the quote (wei), when known. */
  tradingFee?: bigint;
  /** Fee charged on close (wei), when known. */
  closeFee?: bigint;
  /** Affiliate address attributed to the quote, when known. */
  affiliate?: Address;
  /** PartyB addresses allowed to fill this quote (empty means any), when known. */
  partyBsWhiteList?: readonly Address[];
  /** Parent quote id for a partially-opened child, when known. */
  parentId?: bigint;
  /** Opaque per-quote data, when known. */
  data?: Hex;
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
