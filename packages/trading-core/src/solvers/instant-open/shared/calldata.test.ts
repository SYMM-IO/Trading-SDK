import type { Address, Hex } from "viem";
import { zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { SymmError } from "../../../shared/errors/symm-error";
import {
  buildQuoteMetadata,
  encodeSendQuoteWithAffiliateAndData,
  getFakeSendQuoteMuonSignature,
  sendQuoteUpnlSigFlexRange,
  ZERO_UPNL_SIG,
} from "./calldata";
import type { UpnlSig } from "./types";

const SOLVER: Address = "0x76bc5889c0cfcC20960b0D81F541595d81a95122";
const SOLVER_2: Address = "0x81631953E0C093e72935C1CAA4C7D519B2A0E407";
const AFFILIATE: Address = "0x45Eecd7B4f442388ACD90467E423A5CAAC3a9C3f";
const PRICE = 50_000000000000000000n;

/** A live Muon sig: 32-byte `reqId` plus a 65-byte ECDSA gateway signature. */
const REAL_SIG: UpnlSig = {
  reqId: `0x${"11".repeat(32)}`,
  timestamp: 1_700_000_000n,
  upnl: -25_000000000000000000n,
  price: PRICE,
  gatewaySignature: `0x${"22".repeat(65)}`,
  sigs: { signature: 99n, owner: SOLVER, nonce: SOLVER_2 },
};

function encode(upnlSig: UpnlSig | undefined, partyBsWhiteList: readonly Address[] = [SOLVER]): Hex {
  return encodeSendQuoteWithAffiliateAndData({
    partyBsWhiteList,
    symbolId: 1n,
    positionType: 0,
    orderType: 1,
    price: PRICE,
    quantity: 1_000000000000000000n,
    cva: 1_000000000000000000n,
    lf: 500000000000000000n,
    partyAmm: 1_500000000000000000n,
    partyBmm: 1_500000000000000000n,
    deadline: 1_700_000_300n,
    affiliate: AFFILIATE,
    data: buildQuoteMetadata("11111111-2222-3333-4444-555555555555"),
    upnlSig,
  });
}

describe("getFakeSendQuoteMuonSignature", () => {
  it("shapes reqId as 32 zero bytes so the encoded region matches a real signature's layout", () => {
    const fake = getFakeSendQuoteMuonSignature(PRICE);

    expect(fake.reqId).toBe(`0x${"00".repeat(32)}`);
    expect(fake.price).toBe(PRICE);
    expect(fake.upnl).toBe(0n);
    expect(fake.sigs).toEqual({ signature: 0n, owner: zeroAddress, nonce: zeroAddress });
  });
});

describe("sendQuoteUpnlSigFlexRange", () => {
  it("locates the upnlSig region in calldata built with the placeholder signature", () => {
    const callData = encode(getFakeSendQuoteMuonSignature(PRICE));

    const range = sendQuoteUpnlSigFlexRange(callData);

    expect(range.offset).toBeGreaterThan(0n);
    expect(range.length).toBeGreaterThan(0n);
  });

  it("returns a region whose bounds sit inside the encoded arguments", () => {
    const callData = encode(getFakeSendQuoteMuonSignature(PRICE));
    /** Args bytes, i.e. calldata minus the 4-byte selector. */
    const argsBytes = BigInt((callData.length - 2 - 8) / 2);

    const range = sendQuoteUpnlSigFlexRange(callData);

    expect(range.offset + range.length).toBeLessThanOrEqual(argsBytes);
  });

  it("shifts the offset when an earlier dynamic argument grows", () => {
    const one = sendQuoteUpnlSigFlexRange(encode(getFakeSendQuoteMuonSignature(PRICE), [SOLVER]));
    const two = sendQuoteUpnlSigFlexRange(encode(getFakeSendQuoteMuonSignature(PRICE), [SOLVER, SOLVER_2]));

    /** One extra whitelist entry adds a word to the tail that precedes upnlSig. */
    expect(two.offset).toBe(one.offset + 32n);
    expect(two.length).toBe(one.length);
  });

  it("sizes the region by the signature's own bytes, not the surrounding call", () => {
    const zero = sendQuoteUpnlSigFlexRange(encode(ZERO_UPNL_SIG));
    const placeholder = sendQuoteUpnlSigFlexRange(encode(getFakeSendQuoteMuonSignature(PRICE)));
    const real = sendQuoteUpnlSigFlexRange(encode(REAL_SIG));

    /**
     * Byte-size ladder. The placeholder's 32-byte `reqId` costs one word over the
     * empty-bytes `ZERO_UPNL_SIG`; a live signature costs a further three words
     * for its 65-byte gateway signature. If a vendor ever requires the reserved
     * window to equal the live size, this is the assertion that has to move.
     */
    expect(placeholder.length).toBe(zero.length + 32n);
    expect(real.length).toBe(placeholder.length + 96n);
    /** Offsets are identical — only the tail size differs. */
    expect(placeholder.offset).toBe(zero.offset);
    expect(real.offset).toBe(zero.offset);
  });

  it("throws a SymmError when the calldata is truncated", () => {
    const callData = encode(getFakeSendQuoteMuonSignature(PRICE));
    const truncated = callData.slice(0, 40) as Hex;

    expect(() => sendQuoteUpnlSigFlexRange(truncated)).toThrow(SymmError);
  });
});
