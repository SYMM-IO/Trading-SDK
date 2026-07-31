import type { Address, Hex } from "viem";
import type { SchnorrSign } from "../account-layer/types";

/**
 * A Muon attestation covering a party's uPnL **and** a symbol price, mirrored
 * from the on-chain `SingleUpnlAndPriceSig` struct field-for-field (same order)
 * so the object encodes directly as the contract tuple without translation.
 *
 * @remarks
 * This is the `upnlSig` argument of `sendQuoteWithAffiliateAndData`. Solvers
 * that enforce Muon verification (Rasa / majors) require a live attestation
 * here; the lowcap InstantLayer flow instead passes a placeholder and delegates
 * the byte range to the solver. Fetch a fresh one with `getSendQuoteUpnlSig`
 * immediately before signing — the attestation is timestamped and short-lived.
 *
 * Compare {@link SingleUpnlSig}, which is the uPnL-only variant (no `price`).
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.5/contracts/core/storages/MuonStorage.sol}
 */
export interface SingleUpnlAndPriceSig {
  /** Muon request id (opaque bytes). */
  reqId: Hex;
  /** Attestation timestamp (seconds). */
  timestamp: bigint;
  /** Signed unrealized PnL of the party, `int256` (may be negative). */
  upnl: bigint;
  /** Attested symbol price as 18-decimal fixed point. */
  price: bigint;
  /** Muon gateway signature over the request (opaque bytes). */
  gatewaySignature: Hex;
  /** The Schnorr TSS signature pieces. */
  sigs: SchnorrSign;
}

/**
 * A Muon attestation covering a symbol's price range over a time window,
 * mirrored from the on-chain `HighLowPriceSig` struct field-for-field (same
 * order) so the object encodes directly as the contract tuple without
 * translation.
 *
 * @remarks
 * This is what `forceClosePosition` / `settleAndForceClosePosition` verify to
 * prove the market traded through the position's close price during the window.
 * Fetch one with `getForceClosePriceSig`.
 *
 * **Field-order footgun:** `upnlPartyB` comes **before** `upnlPartyA`. Swapping
 * them type-checks green (both are `bigint`) and silently mis-encodes the call.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.5/contracts/core/storages/MuonStorage.sol}
 */
export interface HighLowPriceSig {
  /** Muon request id (opaque bytes). */
  reqId: Hex;
  /** Attestation timestamp (seconds). */
  timestamp: bigint;
  /** Symbol id the price range is for. */
  symbolId: bigint;
  /** Highest price observed in the window, 18-decimal fixed point. */
  highest: bigint;
  /** Lowest price observed in the window, 18-decimal fixed point. */
  lowest: bigint;
  /** Mean price over the window, 18-decimal fixed point (Muon returns it as `mean`). */
  averagePrice: bigint;
  /** Window start timestamp (seconds). */
  startTime: bigint;
  /** Window end timestamp (seconds). */
  endTime: bigint;
  /** PartyB's signed unrealized PnL, `int256`. Declared **before** `upnlPartyA`. */
  upnlPartyB: bigint;
  /** PartyA's signed unrealized PnL, `int256`. */
  upnlPartyA: bigint;
  /** Current price at attestation time, 18-decimal fixed point. */
  currentPrice: bigint;
  /** Muon gateway signature over the request (opaque bytes). */
  gatewaySignature: Hex;
  /** The Schnorr TSS signature pieces. */
  sigs: SchnorrSign;
}

/**
 * Lifecycle status of a SYMMIO withdraw request.
 *
 * @remarks
 * Names and ordering mirror the on-chain `enum WithdrawStatus` in
 * `WithdrawStorage.sol` (perps-core v0.8.5) exactly, so the `uint8` returned by
 * the withdraw read views casts directly to this enum without translation.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.5/contracts/core/storages/WithdrawStorage.sol}
 */
export enum WithdrawStatus {
  /** Created, awaiting provider acceptance (classic withdrawals stay here until finalized). */
  PENDING = 0,
  /** A provider accepted the request. */
  PROVIDER_ACCEPTED = 1,
  /** A provider declined the request; it was refunded. */
  PROVIDER_REJECTED = 2,
  /** Finalized successfully; funds were paid out. */
  COMPLETED = 3,
  /** The user requested cancellation; awaiting provider approval. */
  CANCEL_REQUESTED = 4,
  /** Fully cancelled and refunded. */
  CANCELLED = 5,
  /** Suspended due to a user-level restriction. */
  SUSPENDED = 6,
}

/**
 * One receiver "part" of a withdraw request. A single request may split its
 * amount across several parts (different chains/providers); a plain same-chain
 * withdrawal is a single part with both provider fields set to the zero address.
 *
 * Field shapes and ordering mirror the on-chain `WithdrawReceiverPart` struct in
 * `WithdrawStorage.sol` (perps-core v0.8.5) exactly, so the object encodes
 * directly as the contract tuple without translation.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.5/contracts/core/storages/WithdrawStorage.sol}
 */
export interface WithdrawReceiverPart {
  /** Caller-assigned part id, unique within the request. */
  id: bigint;
  /** Amount of collateral for this part, in the collateral token's smallest unit. */
  amount: bigint;
  /** Destination chain id (`int256` on-chain; the source chain for a same-chain part). */
  chainId: bigint;
  /** Destination address as raw bytes (a 20-byte EVM address is its own byte representation). */
  receiver: Hex;
  /** Virtual (cross-chain) provider, or the zero address for a same-chain part. */
  virtualProvider: Address;
  /** Express (instant) provider, or the zero address for a standard-cooldown part. */
  expressProvider: Address;
}

/**
 * A full withdraw request as stored on the SYMMIO core, returned by the withdraw
 * read views ({@link "getWithdrawRequests"}, {@link "getPendingWithdrawRequests"}).
 *
 * Field shapes and ordering mirror the on-chain `WithdrawRequest` struct in
 * `WithdrawStorage.sol` (perps-core v0.8.5) exactly. `status` is surfaced as the
 * {@link WithdrawStatus} enum rather than a raw `uint8`.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.5/contracts/core/storages/WithdrawStorage.sol}
 */
export interface WithdrawRequest {
  /** Sequential request id (starts at 1 per user). */
  id: bigint;
  /** The subaccount the request belongs to. */
  user: Address;
  /** The receiver parts the withdrawal is split into. */
  parts: readonly WithdrawReceiverPart[];
  /** Block timestamp at which the request was created. */
  timestamp: bigint;
  /** Earliest timestamp the request can be finalized. */
  cooldownEndTime: bigint;
  /** Current lifecycle status. */
  status: WithdrawStatus;
  /** Whether the request opted into the cooldown speed-up flow. */
  speedUp: boolean;
  /** Whether the cooldown was modified after creation (e.g. by an accepted speed-up). */
  isCooldownModified: boolean;
  /** The provider bound to the request, or the zero address for a classic withdrawal. */
  provider: Address;
  /** Whether the request is a pure-virtual (cross-chain, no express) withdrawal. */
  isPureVirtual: boolean;
  /** Opaque provider data (e.g. a signed option), or `0x`. */
  providerData: Hex;
  /** Total collateral amount across all parts. */
  totalAmount: bigint;
  /** Total amount delivered via virtual providers. */
  totalVirtualAmount: bigint;
}

/**
 * Direction of a trading position.
 *
 * @remarks
 * Names and ordering mirror the on-chain `enum PositionType` in
 * `QuoteStorage.sol` (perps-core v0.8.5) exactly, so the `uint8` carried on a
 * {@link Quote} casts directly to this enum without translation.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.5/contracts/core/storages/QuoteStorage.sol}
 */
export enum PositionType {
  /** A long position — profits when the market price rises. */
  LONG = 0,
  /** A short position — profits when the market price falls. */
  SHORT = 1,
}

/**
 * How an order is priced and filled.
 *
 * @remarks
 * Names and ordering mirror the on-chain `enum OrderType` in `QuoteStorage.sol`
 * (perps-core v0.8.5) exactly, so the `uint8` carried on a {@link Quote} casts
 * directly to this enum without translation.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.5/contracts/core/storages/QuoteStorage.sol}
 */
export enum OrderType {
  /** Fills only at the requested price or better. */
  LIMIT = 0,
  /** Fills at the prevailing market price. */
  MARKET = 1,
}

/**
 * Lifecycle status of a quote, from creation through settlement.
 *
 * @remarks
 * Names and ordering mirror the on-chain `enum QuoteStatus` in
 * `QuoteStorage.sol` (perps-core v0.8.5) exactly — all 11 members, including
 * `LIQUIDATED_PENDING` (10) — so the `uint8` carried on a {@link Quote} casts
 * directly to this enum without translation. `getPartyAOpenPositions` returns
 * only `OPENED`, `CLOSE_PENDING`, `CANCEL_CLOSE_PENDING`, and `LIQUIDATED_PENDING`
 * quotes; `getPartyAPendingQuotes` returns only `PENDING`, `LOCKED`, and
 * `CANCEL_PENDING`.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.5/contracts/core/storages/QuoteStorage.sol}
 */
export enum QuoteStatus {
  /** Created, awaiting a partyB to lock it. */
  PENDING = 0,
  /** A partyB locked the quote and is preparing to open it. */
  LOCKED = 1,
  /** PartyA requested cancellation of a still-pending quote. */
  CANCEL_PENDING = 2,
  /** The pending quote was cancelled before opening. */
  CANCELED = 3,
  /** Opened into a live position. */
  OPENED = 4,
  /** PartyA requested a (full or partial) close of the open position. */
  CLOSE_PENDING = 5,
  /** PartyA requested cancellation of a pending close. */
  CANCEL_CLOSE_PENDING = 6,
  /** The position was fully closed. */
  CLOSED = 7,
  /** The position was liquidated. */
  LIQUIDATED = 8,
  /** The pending quote expired before being opened. */
  EXPIRED = 9,
  /** Liquidation is in progress for the position. */
  LIQUIDATED_PENDING = 10,
}

/**
 * Margin amounts locked against a {@link Quote}, in the collateral token's
 * smallest unit (raw `uint256`).
 *
 * Field shapes and ordering mirror the on-chain `struct LockedValues` in
 * `QuoteStorage.sol` (perps-core v0.8.5) exactly, so the object decodes directly
 * from the contract tuple without translation.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.5/contracts/core/storages/QuoteStorage.sol}
 */
export interface LockedValues {
  /** Credit Valuation Adjustment locked by partyA. */
  cva: bigint;
  /** Liquidation Fee locked by partyA. */
  lf: bigint;
  /** PartyA maintenance margin. */
  partyAmm: bigint;
  /** PartyB maintenance margin. */
  partyBmm: bigint;
}

/**
 * A full trading quote or open position as stored on the SYMMIO core, returned
 * by the quote read views ({@link "getQuote"}, {@link "getPartyAOpenPositions"}).
 *
 * Field shapes and ordering mirror the on-chain `struct Quote` in
 * `QuoteStorage.sol` (perps-core v0.8.5) exactly — every `uint256`/`int256` is a
 * raw `bigint` (no decimal scaling applied) and the `uint8` enum fields are
 * surfaced as the {@link PositionType}, {@link OrderType}, and {@link QuoteStatus}
 * enums rather than raw numbers. Prices and amounts are 18-decimal fixed point.
 *
 * @see {@link https://github.com/SYMM-IO/perps-core/blob/version_0.8.5/contracts/core/storages/QuoteStorage.sol}
 */
export interface Quote {
  /** Sequential quote id (starts at 1; `0n` is the not-found sentinel). */
  id: bigint;
  /** PartyB addresses allowed to fill this quote (empty means any). */
  partyBsWhiteList: readonly Address[];
  /** Market identifier (`symbolId`) the quote trades. */
  symbolId: bigint;
  /** Long or short. */
  positionType: PositionType;
  /** Limit or market order. */
  orderType: OrderType;
  /** Price partyB actually opened at (0 until opened). */
  openedPrice: bigint;
  /** Price partyA originally requested to open at. */
  initialOpenedPrice: bigint;
  /** Current requested open price (may differ from `initialOpenedPrice` after edits). */
  requestedOpenPrice: bigint;
  /** Market price snapshot recorded on the quote at its last state change. */
  marketPrice: bigint;
  /** Total quantity partyA requested. */
  quantity: bigint;
  /** Quantity already closed. */
  closedAmount: bigint;
  /** Margin locked at open time (basis for leverage). */
  initialLockedValues: LockedValues;
  /** Margin currently locked. */
  lockedValues: LockedValues;
  /** Maximum funding rate partyA accepts. */
  maxFundingRate: bigint;
  /** Owner of the quote — the virtual account (lowcap). */
  partyA: Address;
  /** The partyB (hedger/solver) that locked/opened the quote, or the zero address. */
  partyB: Address;
  /** Current lifecycle status. */
  quoteStatus: QuoteStatus;
  /** Average price across executed closes. */
  avgClosedPrice: bigint;
  /** Requested limit price for a pending close. */
  requestedClosePrice: bigint;
  /** Quantity of a pending close request. */
  quantityToClose: bigint;
  /** Parent quote id for a partially-opened child, or `0n`. */
  parentId: bigint;
  /** Block timestamp the quote was created. */
  createTimestamp: bigint;
  /** Block timestamp of the last status change (sort key). */
  statusModifyTimestamp: bigint;
  /** Block timestamp funding was last applied. */
  lastFundingPaymentTimestamp: bigint;
  /** Quote deadline (expiry) timestamp. */
  deadline: bigint;
  /** Trading fee charged on the quote. */
  tradingFee: bigint;
  /** Affiliate address attributed to the quote, or the zero address. */
  affiliate: Address;
  /** Net funding paid (positive) or received (negative) over the position's life (`int256`). */
  accumulatedPaidFunding: bigint;
  /** Fee charged on close. */
  closeFee: bigint;
  /** Opaque per-quote data, or `0x`. */
  data: Hex;
}
