import axios from "axios";
import type { Address, PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { getSendQuoteUpnlSig } from "./get-send-quote-upnl-sig";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const PARTY_A: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const NONCE: Address = "0xcccccccccccccccccccccccccccccccccccccccc";
const SYMBOL_ID = 7n;
const config = createConfig({ getClient: () => ({}) as PublicClient, symmioConfig: {} });

function rawResponse(result: Record<string, unknown>) {
  return {
    success: true,
    result: {
      reqId: "0x1234",
      data: {
        timestamp: 1_700_000_000,
        result,
        init: { nonceAddress: NONCE },
      },
      nodeSignature: "0xabcd",
      signatures: [{ signature: "0x63", owner: OWNER }],
    },
  };
}

const RAW = rawResponse({ uPnl: "-25000000000000000000", price: "50000000000000000000" });

describe("getSendQuoteUpnlSig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and assembles the SingleUpnlAndPriceSig from the first oracle URL", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: RAW });

    const sig = await getSendQuoteUpnlSig(config, { partyA: PARTY_A, symbolId: SYMBOL_ID });

    expect(sig).toEqual({
      reqId: "0x1234",
      timestamp: 1_700_000_000n,
      upnl: -25_000000000000000000n,
      price: 50_000000000000000000n,
      gatewaySignature: "0xabcd",
      sigs: { signature: 99n, owner: OWNER, nonce: NONCE },
    });
    expect(get).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        baseURL: DEFAULT.muon.urls[0],
        params: {
          app: "symmio",
          method: "uPnl_A_withSymbolPrice",
          "params[partyA]": PARTY_A,
          "params[chainId]": String(DEFAULT.chainId),
          "params[symmio]": DEFAULT.addresses.symmioAddress,
          "params[symbolId]": String(SYMBOL_ID),
        },
      }),
    );
  });

  it("defaults a missing price to 0n rather than failing", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: rawResponse({ uPnl: "0" }) });

    const sig = await getSendQuoteUpnlSig(config, { partyA: PARTY_A, symbolId: SYMBOL_ID });

    expect(sig.price).toBe(0n);
  });

  it("throws a SymmError when uPnl is missing", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: rawResponse({ price: "1" }) });

    await expect(getSendQuoteUpnlSig(config, { partyA: PARTY_A, symbolId: SYMBOL_ID })).rejects.toThrow(SymmError);
  });

  it("falls back to the next oracle URL when one fails", async () => {
    const get = vi.spyOn(axios, "get").mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ data: RAW });

    const sig = await getSendQuoteUpnlSig(config, { partyA: PARTY_A, symbolId: SYMBOL_ID });

    expect(sig.reqId).toBe("0x1234");
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("throws a SymmError when every oracle URL fails", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("network"));

    await expect(getSendQuoteUpnlSig(config, { partyA: PARTY_A, symbolId: SYMBOL_ID })).rejects.toBeInstanceOf(
      SymmError,
    );
  });

  it("throws a SymmError when every oracle returns an unsuccessful attestation", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: { success: false, result: RAW.result } });

    await expect(getSendQuoteUpnlSig(config, { partyA: PARTY_A, symbolId: SYMBOL_ID })).rejects.toThrow(SymmError);
  });
});
