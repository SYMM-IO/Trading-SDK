import { encodeAbiParameters, encodeFunctionData, zeroAddress, type Address, type Hex } from "viem";
import { accountLayerAbi } from "../../../symmio-contracts/abi/v0.8.5/account-layer";
import { symmioAbi } from "../../../symmio-contracts/abi/v0.8.5/symmio";
import type { UpnlSig, VirtualAccountIsolationType } from "./types";

/**
 * Zeroed Muon oracle signature used by lowcap flows that bypass Muon verification.
 */
export const ZERO_UPNL_SIG: UpnlSig = {
  reqId: "0x",
  timestamp: 0n,
  upnl: 0n,
  price: 0n,
  gatewaySignature: "0x",
  sigs: { signature: 0n, owner: zeroAddress, nonce: zeroAddress },
};

/**
 * Build a placeholder Muon signature carrying only the trade price.
 *
 * Used in lowcap flows where the InstantLayer accepts a zero/fake signature
 * but the contract still reads `upnlSig.price` for accounting. The single
 * canonical price for the trade (the slippage-adjusted open price in wei)
 * is what callers pass here.
 *
 * @param priceWei - Trade price as 18-decimal fixed point (`bigint`).
 */
export function getFakeSendQuoteMuonSignature(priceWei: bigint): UpnlSig {
  return {
    reqId: "0x",
    timestamp: BigInt(Math.floor(Date.now() / 1000)),
    upnl: 0n,
    price: priceWei,
    gatewaySignature: "0x",
    sigs: { signature: 0n, owner: zeroAddress, nonce: zeroAddress },
  };
}

/**
 * Parameters for {@link encodeAddMarginToNextVA}.
 */
export interface EncodeAddMarginToNextVAParameters {
  /** Sub-account address (typically the user's wallet). */
  subAccount: Address;
  /** Virtual-account isolation type. */
  isolationType: VirtualAccountIsolationType;
  /** Market symbol id. */
  symbolId: bigint;
  /** Margin amount as 18-decimal fixed point. */
  amount: bigint;
}

/**
 * Encode calldata for `AccountLayer.addMarginToNextVA(subAccount, isolationType, symbolId, amount)`.
 *
 * The contract picks the next VA address internally — no client-side prediction needed.
 */
export function encodeAddMarginToNextVA(parameters: EncodeAddMarginToNextVAParameters): Hex {
  return encodeFunctionData({
    abi: accountLayerAbi,
    functionName: "addMarginToNextVA",
    args: [parameters.subAccount, parameters.isolationType, parameters.symbolId, parameters.amount],
  });
}

/**
 * Parameters for {@link encodeSendQuoteWithAffiliateAndData}.
 */
export interface EncodeSendQuoteWithAffiliateAndDataParameters {
  /** Allowed partyB addresses. */
  partyBsWhiteList: readonly Address[];
  /** Market symbol id. */
  symbolId: bigint;
  /** Position type contract value (0 LONG, 1 SHORT). */
  positionType: number;
  /** Order type contract value (0 LIMIT, 1 MARKET). */
  orderType: number;
  /** Requested open price as 18-decimal fixed point. */
  price: bigint;
  /** Order quantity as 18-decimal fixed point. */
  quantity: bigint;
  /** CVA locked margin as 18-decimal fixed point. */
  cva: bigint;
  /** LF locked margin as 18-decimal fixed point. */
  lf: bigint;
  /** PartyA maintenance margin as 18-decimal fixed point. */
  partyAmm: bigint;
  /** PartyB maintenance margin as 18-decimal fixed point. */
  partyBmm: bigint;
  /** Unix-seconds deadline. */
  deadline: bigint;
  /** Affiliate registry address. */
  affiliate: Address;
  /** ABI-encoded metadata blob (e.g. UUID). */
  data: Hex;
  /** Muon signature. Defaults to {@link ZERO_UPNL_SIG} for lowcap. */
  upnlSig?: UpnlSig;
}

/**
 * Encode calldata for `Symmio.sendQuoteWithAffiliateAndData(...)`.
 *
 * Pass a real `upnlSig` for solvers requiring Muon verification, or omit to
 * default to {@link ZERO_UPNL_SIG} (lowcap).
 */
export function encodeSendQuoteWithAffiliateAndData(parameters: EncodeSendQuoteWithAffiliateAndDataParameters): Hex {
  const sig = parameters.upnlSig ?? ZERO_UPNL_SIG;
  return encodeFunctionData({
    abi: symmioAbi,
    functionName: "sendQuoteWithAffiliateAndData",
    args: [
      [...parameters.partyBsWhiteList],
      parameters.symbolId,
      parameters.positionType,
      parameters.orderType,
      parameters.price,
      parameters.quantity,
      parameters.cva,
      parameters.lf,
      parameters.partyAmm,
      parameters.partyBmm,
      parameters.deadline,
      parameters.affiliate,
      {
        reqId: sig.reqId,
        timestamp: sig.timestamp,
        upnl: sig.upnl,
        price: sig.price,
        gatewaySignature: sig.gatewaySignature,
        sigs: {
          signature: sig.sigs.signature,
          owner: sig.sigs.owner,
          nonce: sig.sigs.nonce,
        },
      },
      parameters.data,
    ],
  });
}

/**
 * Build the metadata blob attached to a `sendQuoteWithAffiliateAndData` call.
 *
 * Encodes a single-field tuple `{ uuid: string }` to ABI bytes — used by the
 * solver to track quote provenance.
 *
 * @param uuid - Opaque identifier (caller-controlled; usually `crypto.randomUUID()`).
 */
export function buildQuoteMetadata(uuid: string): Hex {
  return encodeAbiParameters([{ type: "tuple", components: [{ type: "string", name: "uuid" }] }], [{ uuid }]);
}
