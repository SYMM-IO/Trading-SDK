import { describe, expect, it } from "vitest";
import type { PoolDexPair } from "./dex";
import {
  getPoolEnrichmentNeeds,
  getPoolTokenDexStats,
  selectPoolDetailDexData,
  selectPoolEnrichment,
} from "./select-enrichment";

const pairs = [
  {
    chainId: "solana",
    dexId: "raydium",
    baseToken: { address: "Mint", name: "Token", symbol: "T" },
    liquidity: { usd: 100 },
    info: { imageUrl: "image" },
  },
  {
    chainId: "solana",
    dexId: "pumpswap",
    baseToken: { address: "Mint", name: "Token", symbol: "T" },
    liquidity: { usd: 20 },
    priceUsd: "0.25",
    marketCap: 40,
  },
] as unknown as PoolDexPair[];

describe("pool enrichment source selection", () => {
  it("preserves the list image/DEX source and takes price from a priced pair", () => {
    expect(selectPoolEnrichment({ pairs, jupiterPrice: 9, metadataPrice: "10" }).dexScreener).toMatchObject({
      tokenImage: "image",
      dexId: "raydium",
      priceUsd: "0.25",
      marketCap: 40,
    });
    expect(selectPoolDetailDexData(pairs)).toMatchObject({ tokenImage: "image", dexId: "pumpswap", priceUsd: "0.25" });
  });
  it("preserves an existing detail price, falls back Jupiter then metadata, and ignores invalid caps", () => {
    expect(selectPoolEnrichment({ current: { priceUsd: "0.01" }, jupiterPrice: 9 }).dexScreener?.priceUsd).toBe("0.01");
    expect(selectPoolEnrichment({ jupiterPrice: 2, metadataPrice: "3" }).dexScreener?.priceUsd).toBe("2");
    expect(selectPoolEnrichment({ metadataPrice: "3", geckoMarketCap: 0 }).dexScreener?.priceUsd).toBe("3");
    expect(selectPoolEnrichment({ geckoMarketCap: NaN }).marketCapUsd).toBeUndefined();
  });
  it("waits for DEX completion before Gecko and keeps fallback eligibility independent", () => {
    const input = { isSolana: true, geckoSupported: true, dexLoaded: false };
    expect(getPoolEnrichmentNeeds(input)).toEqual({ jupiter: true, pump: true, gecko: false });
    expect(getPoolEnrichmentNeeds({ ...input, dexLoaded: true, pairs })).toEqual({
      jupiter: false,
      pump: false,
      gecko: false,
    });
    expect(getPoolEnrichmentNeeds({ ...input, dexLoaded: true, pairs: [] })).toEqual({
      jupiter: true,
      pump: true,
      gecko: true,
    });
  });
  it("sums preview liquidity while leaving a missing deepest-pair price unknown", () => {
    expect(getPoolTokenDexStats(pairs)).toMatchObject({
      totalLiquidity: 120,
      totalMarketCap: 0,
      priceUsd: undefined,
      imageUrl: "image",
      dexId: "raydium",
    });
  });
});
