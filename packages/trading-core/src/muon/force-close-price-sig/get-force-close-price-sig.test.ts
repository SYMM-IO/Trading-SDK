import axios from "axios";
import type { Address, PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { getForceClosePriceSig } from "./get-force-close-price-sig";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const PARTY_A: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PARTY_B: Address = "0xdddddddddddddddddddddddddddddddddddddddd";
const OWNER: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const NONCE: Address = "0xcccccccccccccccccccccccccccccccccccccccc";
const PARAMS = { partyA: PARTY_A, partyB: PARTY_B, symbolId: 7n, t0: 1_700_000_000n, t1: 1_700_003_600n };
const config = createConfig({ getClient: () => ({}) as PublicClient, symmioConfig: {} });

const RESULT = {
  symbolId: "7",
  highest: "52000000000000000000",
  lowest: "48000000000000000000",
  mean: "50000000000000000000",
  startTime: "1700000000",
  endTime: "1700003600",
  uPnlB: "25000000000000000000",
  uPnlA: "-25000000000000000000",
  price: "49000000000000000000",
};

const RAW = {
  success: true,
  result: {
    reqId: "0x1234",
    data: {
      timestamp: 1_700_003_600,
      result: RESULT,
      init: { nonceAddress: NONCE },
    },
    nodeSignature: "0xabcd",
    signatures: [{ signature: "0x63", owner: OWNER }],
  },
};

describe("getForceClosePriceSig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and assembles the HighLowPriceSig from the first oracle URL", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: RAW });

    const sig = await getForceClosePriceSig(config, PARAMS);

    expect(sig).toEqual({
      reqId: "0x1234",
      timestamp: 1_700_003_600n,
      symbolId: 7n,
      highest: 52_000000000000000000n,
      lowest: 48_000000000000000000n,
      averagePrice: 50_000000000000000000n,
      startTime: 1_700_000_000n,
      endTime: 1_700_003_600n,
      upnlPartyB: 25_000000000000000000n,
      upnlPartyA: -25_000000000000000000n,
      currentPrice: 49_000000000000000000n,
      gatewaySignature: "0xabcd",
      sigs: { signature: 99n, owner: OWNER, nonce: NONCE },
    });
    expect(get).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        baseURL: DEFAULT.muon.urls[0],
        params: {
          app: "symmio",
          method: "priceRange",
          "params[t0]": "1700000000",
          "params[t1]": "1700003600",
          "params[partyA]": PARTY_A,
          "params[partyB]": PARTY_B,
          "params[chainId]": String(DEFAULT.chainId),
          "params[symmio]": DEFAULT.addresses.symmioAddress,
          "params[symbolId]": "7",
        },
      }),
    );
  });

  it("maps the renamed wire fields onto their struct names", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: RAW });

    const sig = await getForceClosePriceSig(config, PARAMS);

    /** `mean` → `averagePrice` and `price` → `currentPrice`, not the other way around. */
    expect(sig.averagePrice).toBe(BigInt(RESULT.mean));
    expect(sig.currentPrice).toBe(BigInt(RESULT.price));
    /** `upnlPartyB` precedes `upnlPartyA` in the struct; both are `int256`. */
    expect(sig.upnlPartyB).toBe(BigInt(RESULT.uPnlB));
    expect(sig.upnlPartyA).toBe(BigInt(RESULT.uPnlA));
    expect(sig.upnlPartyB).not.toBe(sig.upnlPartyA);
  });

  it("throws a SymmError when a required range field is missing", async () => {
    const withoutMean = Object.fromEntries(Object.entries(RESULT).filter(([key]) => key !== "mean"));
    vi.spyOn(axios, "get").mockResolvedValue({
      data: { ...RAW, result: { ...RAW.result, data: { ...RAW.result.data, result: withoutMean } } },
    });

    await expect(getForceClosePriceSig(config, PARAMS)).rejects.toThrow(SymmError);
  });

  it("falls back to the next oracle URL when one fails", async () => {
    const get = vi.spyOn(axios, "get").mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ data: RAW });

    const sig = await getForceClosePriceSig(config, PARAMS);

    expect(sig.reqId).toBe("0x1234");
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("throws a SymmError when every oracle URL fails", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("network"));

    await expect(getForceClosePriceSig(config, PARAMS)).rejects.toBeInstanceOf(SymmError);
  });
});
