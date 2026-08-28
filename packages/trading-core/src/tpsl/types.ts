import type { Address } from "viem";

/**
 * Whether a conditional order trips on the mark price or the last-close
 * (subgraph trade) price.
 */
export type TpSlPriceType = "markPrice" | "lastPrice";

/** Conditional-order kind. */
export type TpSlConditionalOrderType = "take_profit" | "stop_loss";

/**
 * Order kinds the handler's **search** can filter on.
 *
 * A superset of {@link TpSlConditionalOrderType}: besides the two TP/SL legs
 * that close a position, the handler also stores `send_quote` orders, which
 * *open* one when a trigger price is hit. Those are what a pool's order book is
 * made of, and they are a different mechanism from a protocol LIMIT order — a
 * solver that declares `limitOrder: false` can still have them.
 */
export enum TpSlSearchOrderType {
  TAKE_PROFIT = "take_profit",
  STOP_LOSS = "stop_loss",
  SEND_QUOTE = "send_quote",
}

/** Lifecycle stage of a TP or SL order, mirroring the handler's `state`. */
export type TpSlInfoState =
  | "loading"
  /** POST is in flight (mutation `isPending`). */
  | "pending"
  /**
   * POST returned 200 — the handler accepted the request but hasn't yet
   * broadcast a `report` with `successful: true`. UI should treat this as
   * "processing" (like `pending`) until the WS confirms.
   */
  | "confirming"
  | "new"
  | "triggered"
  | "canceled"
  | "killed";

/**
 * Folded TP/SL snapshot for a single quote — both sides merged from the
 * handler's per-conditional-order rows.
 */
export interface QuoteTpSl {
  /** Take-profit trigger price (decimal string). Empty when no order. */
  tp: string;
  /** Stop-loss trigger price (decimal string). Empty when no order. */
  sl: string;
  /** Slippage-shifted "opened" price stamped on the TP order (decimal string). */
  tpOpenPrice: string;
  /** Slippage-shifted "opened" price stamped on the SL order (decimal string). */
  slOpenPrice: string;
  tpPriceType: TpSlPriceType;
  slPriceType: TpSlPriceType;
  tpState: TpSlInfoState;
  slState: TpSlInfoState;
  /** Handler-issued conditional-order id for the TP order, when present. */
  tpCohQuoteId?: string;
  /** Handler-issued conditional-order id for the SL order, when present. */
  slCohQuoteId?: string;
}

/**
 * Handler `/configs/` payload — the rules a TP/SL request must satisfy.
 */
export interface TpSlConfig {
  /** Minimum |target − open| / open × 100 the handler accepts (percent). */
  minPriceDistancePercent: number;
  /** Minimum TP↔SL spread as a percent of the open price. */
  minProfitStopLossSpreadPercent: number;
}

/** Handler `/signing-spec` payload — the EIP-712 typed-data domain + schema. */
export interface TpSlSigningSpec {
  domain: { name: string; version: string; chainId: number; verifyingContract: Address };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
}

/** One leg of a conditional-order message body. */
export interface TpSlConditionalOrderLeg {
  quantity: string;
  price: string;
  orderType: number;
  conditionalPrice: string;
  /** Wire form of `TpSlPriceType` — `market` or `last_close`. */
  conditionalPriceType: "market" | "last_close";
}

/** Conditional-order message body (pre-signature). */
export interface TpSlConditionalOrderMessage {
  virtualAccount: Address;
  subAccount: Address;
  salt: string;
  quoteId: number | null;
  symbolId: number;
  positionType: 0 | 1;
  affiliate: Address;
  takeProfit: TpSlConditionalOrderLeg | null;
  stopLoss: TpSlConditionalOrderLeg | null;
  sendQuote: null;
}

/** Delete-order message body (pre-signature). */
export interface TpSlDeleteMessage {
  virtualAccount: Address;
  salt: string;
  cohQuoteId: string;
  conditionalOrderType: TpSlConditionalOrderType;
}

/** Final POST/DELETE body sent to the handler — typed data + signature. */
export interface TpSlSignedRequest {
  typedData: {
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    domain: TpSlSigningSpec["domain"];
    message: Record<string, unknown>;
  };
  signature: string;
  signer: Address;
}

/**
 * Pure validation outcome. `ok: true` means every supplied side passed; `ok:
 * false` carries per-side errors so the UI can render them inline.
 */
export type TpSlValidation =
  | { ok: true; tpError?: undefined; slError?: undefined }
  | { ok: false; tpError?: string; slError?: string };
