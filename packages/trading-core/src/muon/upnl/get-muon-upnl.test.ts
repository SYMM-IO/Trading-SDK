import axios from "axios";
import type { Address, PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { getMuonUpnl } from "./get-muon-upnl";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const PARTY_B: Address = "0xdddddddddddddddddddddddddddddddddddddddd";
const PARTY_A: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const NONCE: Address = "0xcccccccccccccccccccccccccccccccccccccccc";
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

const RAW = {
  success: true,
  result: {
    reqId: "0x1234",
    data: {
      timestamp: 1_700_000_000,
      result: {
        uPnlA: "-25000000000000000000",
        uPnlB: "25000000000000000000",
        notionalValueSumA: "1000000000000000000000",
        notionalValueSumB: "2000000000000000000000",
        quoteIdsA: ["10", "11"],
        quoteIdsB: ["20", "21"],
      },
      init: { nonceAddress: NONCE },
    },
    nodeSignature: "0xabcd",
    signatures: [{ signature: "0x63", owner: OWNER }],
  },
};

describe("getMuonUpnl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and normalizes the uPnl attestation from the first oracle URL", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: RAW });

    const result = await getMuonUpnl(config, { partyB: PARTY_B, partyA: PARTY_A });

    expect(result).toEqual({
      reqId: "0x1234",
      timestamp: 1_700_000_000n,
      nonce: NONCE,
      owner: OWNER,
      signature: 99n,
      gatewaySignature: "0xabcd",
      partyB: PARTY_B,
      partyA: PARTY_A,
      uPnlA: -25_000000000000000000n,
      uPnlB: 25_000000000000000000n,
      notionalValueSumA: 1_000_000000000000000000n,
      notionalValueSumB: 2_000_000000000000000000n,
      quoteIdsA: [10n, 11n],
      quoteIdsB: [20n, 21n],
    });
    expect(get).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        baseURL: DEFAULT.muon.urls[0],
        params: {
          app: "symmio",
          method: "uPnl",
          "params[partyB]": PARTY_B,
          "params[partyA]": PARTY_A,
          "params[chainId]": String(DEFAULT.chainId),
          "params[symmio]": DEFAULT.addresses.symmioAddress,
        },
      }),
    );
  });

  it("falls back to the next oracle URL when one fails", async () => {
    const get = vi.spyOn(axios, "get").mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ data: RAW });

    const result = await getMuonUpnl(config, { partyB: PARTY_B, partyA: PARTY_A });

    expect(result.reqId).toBe("0x1234");
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("throws a SymmError when every oracle URL fails", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("network"));

    await expect(getMuonUpnl(config, { partyB: PARTY_B, partyA: PARTY_A })).rejects.toBeInstanceOf(SymmError);
  });

  it("throws a SymmError when every oracle returns an unsuccessful response", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: { success: false, result: RAW.result } });

    await expect(getMuonUpnl(config, { partyB: PARTY_B, partyA: PARTY_A })).rejects.toThrow(SymmError);
  });
});
