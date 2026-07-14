import axios from "axios";
import type { Address, PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { getDeallocateUpnlSig } from "./get-deallocate-upnl-sig";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const VIRTUAL_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
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
      result: { uPnl: "-25000000000000000000" },
      init: { nonceAddress: NONCE },
    },
    nodeSignature: "0xabcd",
    signatures: [{ signature: "0x63", owner: OWNER }],
  },
};

describe("getDeallocateUpnlSig", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and assembles the SingleUpnlSig from the first oracle URL", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: RAW });

    const sig = await getDeallocateUpnlSig(config, { virtualAccount: VIRTUAL_ACCOUNT });

    expect(sig).toEqual({
      reqId: "0x1234",
      timestamp: 1_700_000_000n,
      upnl: -25_000000000000000000n,
      gatewaySignature: "0xabcd",
      sigs: { signature: 99n, owner: OWNER, nonce: NONCE },
    });
    expect(get).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        baseURL: DEFAULT.muon.urls[0],
        params: {
          app: "symmio",
          method: "uPnl_A",
          "params[partyA]": VIRTUAL_ACCOUNT,
          "params[chainId]": String(DEFAULT.chainId),
          "params[symmio]": DEFAULT.addresses.symmioAddress,
        },
      }),
    );
  });

  it("falls back to the next oracle URL when one fails", async () => {
    const get = vi.spyOn(axios, "get").mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ data: RAW });

    const sig = await getDeallocateUpnlSig(config, { virtualAccount: VIRTUAL_ACCOUNT });

    expect(sig.reqId).toBe("0x1234");
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("throws a SymmError when every oracle URL fails", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("network"));

    await expect(getDeallocateUpnlSig(config, { virtualAccount: VIRTUAL_ACCOUNT })).rejects.toBeInstanceOf(SymmError);
  });

  it("throws a SymmError when every oracle returns an unsuccessful attestation", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: { success: false, result: RAW.result } });

    await expect(getDeallocateUpnlSig(config, { virtualAccount: VIRTUAL_ACCOUNT })).rejects.toThrow(SymmError);
  });
});
