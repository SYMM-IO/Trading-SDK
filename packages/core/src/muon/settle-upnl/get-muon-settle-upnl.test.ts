import axios from "axios";
import type { Address, PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { getMuonSettleUpnl } from "./get-muon-settle-upnl";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const PARTY_A: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const NONCE: Address = "0xcccccccccccccccccccccccccccccccccccccccc";
const QUOTE_IDS = [10n, 11n] as const;
const config = createConfig({ getClient: () => ({}) as PublicClient });

const RAW = {
  success: true,
  result: {
    reqId: "0x1234",
    data: {
      timestamp: 1_700_000_000,
      result: {
        quoteIds: ["10", "11"],
        uPnlA: "-25000000000000000000",
        notionalValueSumA: "1000000000000000000000",
      },
      init: { nonceAddress: NONCE },
    },
    nodeSignature: "0xabcd",
    signatures: [{ signature: "0x63", owner: OWNER }],
  },
};

describe("getMuonSettleUpnl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and normalizes the settle_upnl attestation from the first oracle URL", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: RAW });

    const result = await getMuonSettleUpnl(config, { partyA: PARTY_A, quoteIds: QUOTE_IDS });

    expect(result).toEqual({
      reqId: "0x1234",
      timestamp: 1_700_000_000n,
      nonce: NONCE,
      owner: OWNER,
      signature: 99n,
      gatewaySignature: "0xabcd",
      partyA: PARTY_A,
      quoteIds: [10n, 11n],
      uPnlA: -25_000000000000000000n,
      notionalValueSumA: 1_000_000000000000000000n,
    });
    expect(get).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        baseURL: DEFAULT.muon.urls[0],
        params: {
          app: "symmio",
          method: "settle_upnl",
          "params[partyA]": PARTY_A,
          "params[chainId]": String(DEFAULT.chainId),
          "params[symmio]": DEFAULT.addresses.symmioAddress,
          "params[quoteIds]": "[10,11]",
        },
      }),
    );
  });

  it("falls back to the next oracle URL when one fails", async () => {
    const get = vi.spyOn(axios, "get").mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ data: RAW });

    const result = await getMuonSettleUpnl(config, { partyA: PARTY_A, quoteIds: QUOTE_IDS });

    expect(result.reqId).toBe("0x1234");
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("throws a SymmError when every oracle URL fails", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("network"));

    await expect(getMuonSettleUpnl(config, { partyA: PARTY_A, quoteIds: QUOTE_IDS })).rejects.toBeInstanceOf(SymmError);
  });

  it("throws a SymmError when every oracle returns an unsuccessful response", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: { success: false, result: RAW.result } });

    await expect(getMuonSettleUpnl(config, { partyA: PARTY_A, quoteIds: QUOTE_IDS })).rejects.toThrow(SymmError);
  });
});
