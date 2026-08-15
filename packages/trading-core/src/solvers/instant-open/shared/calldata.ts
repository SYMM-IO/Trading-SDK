import {
  encodeAbiParameters,
  encodeFunctionData,
  hexToBigInt,
  sliceHex,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { SymmError } from "../../../shared/errors/symm-error";
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
 * A `bytes32`-shaped zero value: 32 zero bytes.
 *
 * The placeholder `reqId` must be **byte-shaped like a real one**, because the
 * solver's flex fill replaces an exact byte range (see
 * {@link sendQuoteUpnlSigFlexRange}) — a `0x` empty `bytes` encodes 32 bytes
 * shorter than a real request id and would shift every downstream offset.
 */
const PLACEHOLDER_REQ_ID: Hex = `0x${"00".repeat(32)}`;

/**
 * Build a placeholder Muon signature carrying only the trade price.
 *
 * Used in lowcap flows where the InstantLayer accepts a zero/fake signature
 * but the contract still reads `upnlSig.price` for accounting. The single
 * canonical price for the trade (the slippage-adjusted open price in wei)
 * is what callers pass here.
 *
 * @remarks
 * `reqId` is 32 zero bytes rather than `0x` so the encoded `upnlSig` region is
 * the same size the solver expects when it fills a live signature into the
 * delegated flex range.
 *
 * @param priceWei - Trade price as 18-decimal fixed point (`bigint`).
 */
export function getFakeSendQuoteMuonSignature(priceWei: bigint): UpnlSig {
  return {
    reqId: PLACEHOLDER_REQ_ID,
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

/**
 * Argument indices of `upnlSig` and `data` in `sendQuoteWithAffiliateAndData`,
 * derived from the shipped ABI rather than hardcoded.
 *
 * Both arguments are dynamic (the signature tuple contains two `bytes` members;
 * `data` is `bytes`), so their head words hold tail pointers, and the ABI writes
 * tails in argument order — which is what makes {@link sendQuoteUpnlSigFlexRange}
 * able to derive the region size from the difference. Reading the indices from
 * the ABI means a contract upgrade that reorders the arguments surfaces here at
 * module load instead of silently producing a wrong byte range.
 *
 * @internal
 */
const SEND_QUOTE_ARG_INDICES = (() => {
  const fragment = symmioAbi.find(
    (entry): entry is Extract<(typeof symmioAbi)[number], { name: "sendQuoteWithAffiliateAndData" }> =>
      entry.type === "function" && entry.name === "sendQuoteWithAffiliateAndData",
  );
  if (!fragment) {
    throw new SymmError(
      "config",
      "SEND_QUOTE_ABI_MISSING",
      "The shipped SYMMIO ABI has no `sendQuoteWithAffiliateAndData` function.",
    );
  }
  const inputs = fragment.inputs as readonly { name?: string }[];
  const upnlSig = inputs.findIndex((input) => input.name === "upnlSig");
  const data = inputs.findIndex((input) => input.name === "data");
  if (upnlSig === -1 || data === -1) {
    throw new SymmError(
      "config",
      "SEND_QUOTE_ABI_MISSING",
      "`sendQuoteWithAffiliateAndData` is missing its `upnlSig` or `data` argument in the shipped ABI.",
    );
  }
  return { upnlSig, data };
})();

/** Byte offset of an argument's head word, relative to the start of the arguments. */
const WORD_BYTES = 32;

/**
 * A contiguous calldata region, described the way the InstantLayer's `FlexField`
 * expects it.
 */
export interface SendQuoteUpnlSigFlexRange {
  /**
   * Args-relative byte offset where the region starts — measured **after** the
   * 4-byte function selector, matching the on-chain `FlexField.offset` contract.
   */
  offset: bigint;
  /** Region size in bytes. */
  length: bigint;
}

/**
 * Locate the encoded `upnlSig` region inside `sendQuoteWithAffiliateAndData`
 * calldata, so it can be delegated to a solver via a `FlexField`.
 *
 * Lowcap solvers sign the quote with a placeholder signature
 * ({@link getFakeSendQuoteMuonSignature}) and authorize the solver to overwrite
 * this exact range with a live Muon attestation at execution time. Solvers that
 * require the caller to supply a real signature (majors) do not need this.
 *
 * The region is `[head[upnlSig], head[data])` — `upnlSig` and `data` are both
 * dynamic and adjacent in argument order, so `data`'s tail pointer marks the end
 * of the signature's tail. The offset therefore varies with earlier dynamic
 * arguments (notably `partyBsWhiteList` length) and must never be hardcoded.
 *
 * @param callData - Encoded `sendQuoteWithAffiliateAndData` calldata.
 * @returns The `upnlSig` region as an args-relative offset and byte length.
 * @throws {SymmError} when `callData` is too short to contain both head words,
 *   or the pointers are not ordered as the encoding guarantees.
 *
 * @example
 * ```ts
 * const callData = encodeSendQuoteWithAffiliateAndData({ …, upnlSig: fakeSig });
 * const range = sendQuoteUpnlSigFlexRange(callData);
 * buildSignedOperation({ …, callData, flexFields: [{ ...range, authorizedFlexFiller: solver.address }] });
 * ```
 */
export function sendQuoteUpnlSigFlexRange(callData: Hex): SendQuoteUpnlSigFlexRange {
  /** Strip the 4-byte selector: every offset below is args-relative. */
  const args = `0x${callData.slice(2 + 8)}` as Hex;
  const argsBytes = (args.length - 2) / 2;

  const readHeadWord = (index: number): bigint => {
    const start = index * WORD_BYTES;
    if (start + WORD_BYTES > argsBytes) {
      throw new SymmError(
        "validation",
        "SEND_QUOTE_FLEX_RANGE_INVALID",
        `sendQuote calldata is too short to hold argument head word ${index}.`,
      );
    }
    return hexToBigInt(sliceHex(args, start, start + WORD_BYTES));
  };

  const offset = readHeadWord(SEND_QUOTE_ARG_INDICES.upnlSig);
  const end = readHeadWord(SEND_QUOTE_ARG_INDICES.data);

  if (end <= offset || end > BigInt(argsBytes)) {
    throw new SymmError(
      "validation",
      "SEND_QUOTE_FLEX_RANGE_INVALID",
      `sendQuote calldata has an out-of-order or out-of-bounds upnlSig region (offset ${offset}, end ${end}).`,
    );
  }

  return { offset, length: end - offset };
}
