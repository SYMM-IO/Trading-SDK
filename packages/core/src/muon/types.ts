import type { Address, Hex } from "viem";

/**
 * App name registered for SYMMIO on the Muon network.
 *
 * @see {@link https://docs.symm.io/api-endpoints-and-deployments/muon-api}
 */
export const MUON_APP = "symmio";

/**
 * Muon app method that returns a party's unrealized-PnL attestation — the one
 * `deallocate` / `removeMargin` require.
 */
export const MUON_METHOD_UPNL = "uPnl_A";

/**
 * Raw JSON body returned by the Muon `uPnl_A` endpoint.
 *
 * TODO(muon-openapi): these types are **hand-written** from the Muon API docs
 * and Vibe-ui's response parser — the Muon gateway exposes no OpenAPI/Swagger
 * spec, so there is nothing for orval to generate. Replace these with a
 * generated client (add a `muon` entry to `orval.config.ts`) if/when Muon
 * publishes a machine-readable schema.
 *
 * @see {@link https://docs.symm.io/api-endpoints-and-deployments/muon-api}
 */
export interface MuonUpnlResponse {
  /** `true` when the oracle produced a valid attestation. */
  success: boolean;
  /** The attestation payload (present when `success`). */
  result: MuonUpnlResult;
}

/** The `result` object inside a {@link MuonUpnlResponse}. */
export interface MuonUpnlResult {
  /** Opaque Muon request id (maps to `SingleUpnlSig.reqId`). */
  reqId: Hex;
  /** Attested data plus replay-protection metadata. */
  data: {
    /** Attestation timestamp in seconds (maps to `SingleUpnlSig.timestamp`). */
    timestamp: number;
    /** Computed result fields; only `uPnl` is needed to build the signature. */
    result: {
      /** Signed unrealized PnL as a decimal string (maps to `SingleUpnlSig.upnl`). */
      uPnl: string;
    };
    /** Initialization metadata. */
    init: {
      /** Replay-protection nonce address (maps to `SingleUpnlSig.sigs.nonce`). */
      nonceAddress: Address;
    };
  };
  /** Muon gateway signature (maps to `SingleUpnlSig.gatewaySignature`). */
  nodeSignature: Hex;
  /**
   * Schnorr signature shares. Index `0` carries the aggregated `signature`
   * (a `uint256` encoded as a hex string) and the signer `owner` address.
   */
  signatures: Array<{ signature: Hex; owner: Address }>;
}
