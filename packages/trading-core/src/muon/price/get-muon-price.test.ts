import axios from "axios";
import type { Address, PublicClient } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import { getMuonPrice } from "./get-muon-price";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const OWNER: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const NONCE: Address = "0xcccccccccccccccccccccccccccccccccccccccc";
const QUOTE_IDS = [10n, 11n] as const;
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
        quoteIds: ["10", "11"],
        prices: ["2500000000000000000000", "1800000000000000000"],
        markPrices: ["2501000000000000000000", "1801000000000000000"],
        symbols: ["BTCUSDT", "ETHUSDT"],
      },
      init: { nonceAddress: NONCE },
    },
    nodeSignature: "0xabcd",
    signatures: [{ signature: "0x63", owner: OWNER }],
  },
};

describe("getMuonPrice", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and normalizes the price attestation from the first oracle URL", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: RAW });

    const result = await getMuonPrice(config, { quoteIds: QUOTE_IDS });

    expect(result).toEqual({
      reqId: "0x1234",
      timestamp: 1_700_000_000n,
      nonce: NONCE,
      owner: OWNER,
      signature: 99n,
      gatewaySignature: "0xabcd",
      quoteIds: [10n, 11n],
      prices: [2_500_000000000000000000n, 1_800000000000000000n],
      markPrices: [2_501_000000000000000000n, 1_801000000000000000n],
      maxLeverages: undefined,
      symbols: ["BTCUSDT", "ETHUSDT"],
    });
    expect(get).toHaveBeenCalledWith(
      "",
      expect.objectContaining({
        baseURL: DEFAULT.muon.urls[0],
        params: {
          app: "symmio",
          method: "price",
          "params[quoteIds]": "[10,11]",
          "params[chainId]": String(DEFAULT.chainId),
          "params[symmio]": DEFAULT.addresses.symmioAddress,
        },
      }),
    );
  });

  it("falls back to the next oracle URL when one fails", async () => {
    const get = vi.spyOn(axios, "get").mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({ data: RAW });

    const result = await getMuonPrice(config, { quoteIds: QUOTE_IDS });

    expect(result.reqId).toBe("0x1234");
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("throws a SymmError when every oracle URL fails", async () => {
    vi.spyOn(axios, "get").mockRejectedValue(new Error("network"));

    await expect(getMuonPrice(config, { quoteIds: QUOTE_IDS })).rejects.toBeInstanceOf(SymmError);
  });

  it("throws a SymmError when every oracle returns an unsuccessful response", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({ data: { success: false, result: RAW.result } });

    await expect(getMuonPrice(config, { quoteIds: QUOTE_IDS })).rejects.toThrow(SymmError);
  });
});
