import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPoolDexDataBatch } from "./dex";
import { getPoolGeckoMarketCaps } from "./gecko";
import { getPoolJupiterPrices } from "./jupiter";
import { getPoolPumpData } from "./pump";

afterEach(() => vi.restoreAllMocks());
describe("pool enrichment transport", () => {
  it("batches DEX calls at 30 and retains exact-case addresses across partial failure", async () => {
    const get = vi
      .spyOn(axios, "get")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ data: { pairs: [{ baseToken: { address: "MintZ" } }] } });
    const result = await getPoolDexDataBatch([...Array.from({ length: 30 }, (_, i) => `Mint${i}`), "MintZ"]);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[0]?.[0]).toContain("Mint0,Mint1");
    expect(result.has("MintZ")).toBe(true);
    expect(result.has("mintz")).toBe(false);
  });
  it("keeps exact Jupiter mints, rejecting missing, non-positive and non-finite prices", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({
      data: { MintA: { usdPrice: 0.01 }, MintB: { usdPrice: 0 }, MintC: { usdPrice: Infinity }, MintD: null },
    });
    expect(await getPoolJupiterPrices(["MintA", "MintB"])).toEqual(new Map([["MintA", 0.01]]));
    expect(get.mock.calls[0]?.[1]?.params).toEqual({ ids: "MintA,MintB" });
  });
  it("uses the configured pump proxy, preserving pre-graduation results", async () => {
    const get = vi.spyOn(axios, "get").mockResolvedValue({ data: { MintA: { complete: false } } });
    expect(await getPoolPumpData(["MintA"], "https://app.example/proxy")).toEqual(
      new Map([["MintA", { complete: false }]]),
    );
    expect(get.mock.calls[0]?.[0]).toBe("https://app.example/proxy");
  });
  it("groups Gecko by network and uses FDV only when market cap is unavailable", async () => {
    vi.spyOn(axios, "get").mockResolvedValue({
      data: {
        data: [
          { attributes: { address: "MintA", market_cap_usd: "0", fdv_usd: "42" } },
          { attributes: { address: "MintB", market_cap_usd: "12", fdv_usd: "99" } },
        ],
      },
    });
    expect(await getPoolGeckoMarketCaps([{ chainId: 0, address: "MintA", network: "solana" }])).toEqual(
      new Map([
        ["0:MintA", 42],
        ["0:MintB", 12],
      ]),
    );
  });
});
