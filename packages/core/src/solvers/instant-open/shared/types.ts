import type { Address, Hex } from "viem";
import type { InstantLayerAccount } from "../../../symmio-contracts/instant-layer/types";

/**
 * Re-export the canonical trade-side enum (defined in
 * `symmio-contracts/symmio/types.ts`) so the instant-open slice has one place
 * to import it from. Numeric values match the on-chain enum: `LONG = 0`,
 * `SHORT = 1`.
 */
export { PositionType } from "../../../symmio-contracts/symmio/types";

/** Contract enum value for MARKET orders. */
export const ORDER_TYPE_MARKET = 1 as const;

/**
 * Virtual-account isolation type values used by `addMarginToNextVA`.
 *
 * Matches the on-chain `VirtualAccountIsolationType` enum.
 */
export const VIRTUAL_ACCOUNT_ISOLATION_TYPE = {
  POSITION: 0,
  MARKET: 1,
  MARKET_LONG: 2,
  MARKET_SHORT: 3,
} as const;

export type VirtualAccountIsolationType =
  (typeof VIRTUAL_ACCOUNT_ISOLATION_TYPE)[keyof typeof VIRTUAL_ACCOUNT_ISOLATION_TYPE];

/**
 * Muon oracle signature accepted by `sendQuoteWithAffiliateAndData`.
 *
 * For lowcap flows, pass `ZERO_UPNL_SIG` or build a placeholder with
 * `getFakeSendQuoteMuonSignature`.
 */
export interface UpnlSig {
  /** Request id (typically `0x` for lowcap). */
  reqId: Hex;
  /** Unix-seconds timestamp. */
  timestamp: bigint;
  /** Signed unrealized PnL. */
  upnl: bigint;
  /** Mark price encoded as 18-decimal fixed point. */
  price: bigint;
  /** Gateway signature bytes. */
  gatewaySignature: Hex;
  /** Inner Muon signature tuple. */
  sigs: {
    /** Aggregated signature scalar. */
    signature: bigint;
    /** Owner address. */
    owner: Address;
    /** Nonce address. */
    nonce: Address;
  };
}

/**
 * InstantLayer EIP-712 `ReplayAttackHeader` struct.
 */
export interface ReplayAttackHeader {
  /** Operation nonce (`0n` for single-use ops). */
  nonce: bigint;
  /** Unix-seconds deadline. */
  deadline: bigint;
  /** Random 32-byte salt. */
  salt: Hex;
}

/**
 * InstantLayer EIP-712 `FlexField` struct.
 */
export interface FlexField {
  /** Byte offset into `callData`. */
  offset: bigint;
  /** Byte length. */
  length: bigint;
  /** Address authorized to fill this slot. */
  authorizedFlexFiller: Address;
}

/**
 * InstantLayer EIP-712 `SignedOperation` struct.
 */
export interface SignedOperation {
  /** Session-key signer that produces the EIP-712 signature. */
  signer: Address;
  /** Target contract the operation calls. */
  target: Address;
  /** ABI-encoded calldata for the `target` call. */
  callData: Hex;
  /** Account whose authority the operation runs under. */
  signerAccount: InstantLayerAccount;
  /** Flex fields (empty for lowcap flows). */
  flexFields: FlexField[];
  /** Max number of times the operation may be executed. */
  maxUses: bigint;
  /** Replay-attack protection header. */
  replayAttackHeader: ReplayAttackHeader;
}

/**
 * Wire-format `SignedOperation` accepted by the hedger's `/instant_trade/*` REST API.
 *
 * Re-exports the orval-generated `Eip712SignedOperationJSON` shape; `bigint`s
 * are serialized as decimal strings to survive JSON.
 */
export type { Eip712SignedOperationJSON as SignedOperationPayload } from "../../types/generated/enigma-solver";

/**
 * Wire-format signed-and-signed-operation pair accepted by the hedger API.
 *
 * Re-exports the orval-generated `Eip712OperationWithSigJSON`.
 */
export type { Eip712OperationWithSigJSON as InstantOperationPayload } from "../../types/generated/enigma-solver";

/**
 * Locked-margin breakdown passed to `InstantOpenParameters`.
 *
 * All values are 18-decimal-wei `bigint` matching the contract argument order
 * of `sendQuoteWithAffiliateAndData`.
 */
export interface InstantOpenLockedParams {
  /** CVA locked margin (wei). */
  cva: bigint;
  /** LF locked margin (wei). */
  lf: bigint;
  /** PartyA maintenance margin (wei). */
  partyAmm: bigint;
  /** PartyB maintenance margin (wei). */
  partyBmm: bigint;
}

/**
 * Order-side trade values passed to `InstantOpenParameters`.
 *
 * All wei `bigint`s, final values (already through trade math + leverage).
 */
export interface InstantOpenOrder {
  /** Requested open price (wei). */
  price: bigint;
  /** Leveraged quantity (wei). */
  quantity: bigint;
}

/**
 * Market identification + precision metadata used by the wizard.
 *
 * Only `id` is required. `name`, `pricePrecision`, and `quantityPrecision` are
 * pre-fetched overrides; when omitted, the wizard resolves them from solver
 * `/contract-symbols` via `id`.
 */
export interface InstantOpenMarketData {
  /** Market `symbol_id` from solver markets. */
  id: number;
  /** Pre-fetched market name. When omitted, resolved from solver markets. */
  name?: string;
  /** Pre-fetched market price precision. When omitted, resolved from solver markets. */
  pricePrecision?: number;
  /** Pre-fetched market quantity precision. When omitted, resolved from solver markets. */
  quantityPrecision?: number;
}

/**
 * Margin context passed to `InstantOpenParameters`.
 *
 * The single mark price for the trade lives in `order.price` (wei); it's
 * forwarded into the fake-Muon `upnlSig.price` field by the primitive.
 */
export interface InstantOpenMargin {
  /** Total margin amount for `addMarginToNextVA` (wei). */
  amount: bigint;
}
