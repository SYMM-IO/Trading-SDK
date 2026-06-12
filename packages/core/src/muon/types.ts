import type { Address, Hex } from "viem";

/**
 * App name registered for SYMMIO on the Muon network. Every Muon request carries
 * `app=symmio`.
 *
 * @see {@link https://docs.symm.io/api-endpoints-and-deployments/muon-api}
 */
export const MUON_APP = "symmio";

/**
 * Muon app methods, one per documented `symmio` endpoint. The wire string is the
 * `method` query param.
 *
 * @remarks
 * TODO(muon-verify): only `uPnl_A`'s exact casing and response nesting are
 * verified (against Vibe-ui's parser). The other method strings and their
 * normalized result fields are typed best-effort from the Muon API docs and may
 * need correction once checked against a live gateway.
 *
 * @see {@link https://docs.symm.io/api-endpoints-and-deployments/muon-api}
 */
/** `uPnl_A` — a partyA's unrealized-PnL attestation (the one `removeMargin` requires). */
export const MUON_METHOD_UPNL_A = "uPnl_A";
/** `partyA_overview` — partyA liquidation overview; produces a `LiquidationSig`. */
export const MUON_METHOD_PARTY_A_OVERVIEW = "partyA_overview";
/** `uPnl_A_withSymbolPrice` — partyA uPnL plus a single symbol price. */
export const MUON_METHOD_UPNL_A_WITH_SYMBOL_PRICE = "uPnl_A_withSymbolPrice";
/** `uPnl_B` — a partyB's unrealized-PnL attestation against a partyA. */
export const MUON_METHOD_UPNL_B = "uPnl_B";
/** `uPnl` — combined partyA + partyB unrealized PnL in one attestation. */
export const MUON_METHOD_UPNL_PAIR = "uPnl";
/** `uPnlWithSymbolPrice` — combined partyA + partyB uPnL plus a single symbol price. */
export const MUON_METHOD_UPNL_WITH_SYMBOL_PRICE = "uPnlWithSymbolPrice";
/** `price` — validated prices for a set of quote ids. */
export const MUON_METHOD_PRICE = "price";
/** `settle_upnl` — uPnL settlement data for a partyA's quotes. */
export const MUON_METHOD_SETTLE_UPNL = "settle_upnl";
/** `priceRange` — TWAP-style price range over a window for force-close validation. */
export const MUON_METHOD_PRICE_RANGE = "priceRange";

/**
 * Generic Muon response envelope.
 *
 * @remarks
 * The Muon gateway exposes no OpenAPI/Swagger spec, so these types are
 * hand-written from the API docs + Vibe-ui's response parser. See the
 * TODO(muon-verify) note on {@link MUON_METHOD_UPNL_A}.
 *
 * @see {@link https://docs.symm.io/api-endpoints-and-deployments/muon-api}
 */
export interface MuonResponse {
  /** `true` when the oracle produced a valid attestation. */
  success: boolean;
  /** The attestation payload (present when `success`). */
  result: MuonRawResult;
}

/**
 * The raw `result` object inside a {@link MuonResponse}, before method-specific
 * normalization. The `data.result` map's fields vary per method.
 */
export interface MuonRawResult {
  /** Opaque Muon request id. */
  reqId: Hex;
  /** Attested data plus replay-protection metadata. */
  data: {
    /** Attestation timestamp in seconds. */
    timestamp: number;
    /** Method-specific computed fields (e.g. `uPnl`, `price`, `quoteIds`). */
    result: Record<string, unknown>;
    /** Initialization metadata. */
    init: {
      /** Replay-protection nonce address. */
      nonceAddress: Address;
    };
  };
  /** Muon gateway (node) signature. */
  nodeSignature: Hex;
  /**
   * Schnorr signature shares. Index `0` carries the aggregated `signature`
   * (a `uint256` encoded as a hex string) and the signer `owner` address.
   */
  signatures: Array<{ signature: Hex; owner: Address }>;
}

/**
 * The replay-protection + signature envelope shared by every normalized Muon
 * attestation. Method results extend this with their own computed fields.
 */
export interface MuonAttestationBase {
  /** Opaque Muon request id. */
  reqId: Hex;
  /** Attestation timestamp in seconds. */
  timestamp: bigint;
  /** Replay-protection nonce address (`data.init.nonceAddress`). */
  nonce: Address;
  /** Signer owner address (`signatures[0].owner`). */
  owner: Address;
  /** Aggregated Schnorr signature as `uint256` (`signatures[0].signature`). */
  signature: bigint;
  /** Muon gateway (node) signature (`nodeSignature`). */
  gatewaySignature: Hex;
}
