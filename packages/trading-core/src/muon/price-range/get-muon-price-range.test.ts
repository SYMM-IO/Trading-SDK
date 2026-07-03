import axios from "axios";
import type { Address, PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { getMuonPriceRange } from "./get-muon-price-range";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const PARTY_A: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PARTY_B: Address = "0xdddddddddddddddddddddddddddddddddddddddd";
const OWNER: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const NONCE: Address = "0xcccccccccccccccccccccccccccccccccccccccc";
const T0 = 1_700_000_000n;
const T1 = 1_700_000_900n;
const SYMBOL_ID = 1n;
const config = createConfig({ getClient: () => ({}) as PublicClient });

const RAW = {
  success: true,
  result: {
    reqId: "0x1234",
    data: {
      timestamp: 1_700_000_000,
      result: {
        startTime: "1700000000",
        endTime: "1700000900",
        lowest: "1990000000000000000000",
        highest: "2010000000000000000000",
        mean: "2000000000000000000000",
        price: "2005000000000000000000",
        uPnlA: "-25000000000000000000",
        uPnlB: "25000000000000000000",
      },
      init: { nonceAddress: NONCE },
    },
    nodeSignature: "0xabcd",
    signatures: [{ signature: "0x63", owner: OWNER }],
  },
};

describe("getMuonPriceRange", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and normalizes the priceRange attestation from the first oracle URL", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: RAW });

    const result = await getMuonPriceRange(config, {
      t0: T0,
      t1: T1,
      partyA: PARTY_A,
      partyB: PARTY_B,
      symbolId: SYMBOL_ID,
    });

    expect(result).toEqual({
      reqId: "0x1234",
      timestamp: 1_700_000_000n,
      nonce: NONCE,
      owner: OWNER,
      signature: 99n,
      gatewaySignature: "0xabcd",
      partyA: PARTY_A,
      partyB: PARTY_B,
      symbolId: SYMBOL_ID,
      startTime: 1_700_000_000n,
      endTime: 1_700_000_900n,
      lowest: 1_990_000000000000000000n,
      highest: 2_010_000000000000000000n,
      mean: 2_000_000000000000000000n,
      price: 2_005_000000000000000000n,
      uPnlA: -25_000000000000000000n,
      uPnlB: 25_000000000000000000n,
    });
    expect(get).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        baseURL: DEFAULT.muon.urls[0],
        params: {
          app: "symmio",
          method: "priceRange",
          "params[t0]": T0.toString(),
          "params[t1]": T1.toString(),
          "params[partyA]": PARTY_A,
          "params[partyB]": PARTY_B,
          "params[chainId]": String(DEFAULT.chainId),
          "params[symmio]": DEFAULT.addresses.symmioAddress,
          "params[symbolId]": SYMBOL_ID.toString(),
        },
      }),
    );
  });

  it("falls back to the next oracle URL when one fails", async () => {
    const get = vi.spyOn(axios, "get").mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ data: RAW });

    const result = await getMuonPriceRange(config, {
      t0: T0,
      t1: T1,
      partyA: PARTY_A,
      partyB: PARTY_B,
      symbolId: SYMBOL_ID,
    });

    expect(result.reqId).toBe("0x1234");
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("throws a SymmError when every oracle URL fails", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("network"));

    await expect(
      getMuonPriceRange(config, { t0: T0, t1: T1, partyA: PARTY_A, partyB: PARTY_B, symbolId: SYMBOL_ID }),
    ).rejects.toBeInstanceOf(SymmError);
  });

  it("throws a SymmError when every oracle returns an unsuccessful response", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: { success: false, result: RAW.result } });

    await expect(
      getMuonPriceRange(config, { t0: T0, t1: T1, partyA: PARTY_A, partyB: PARTY_B, symbolId: SYMBOL_ID }),
    ).rejects.toThrow(SymmError);
  });
});
