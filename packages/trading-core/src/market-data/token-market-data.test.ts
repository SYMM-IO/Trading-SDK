import axios, { type AxiosAdapter } from "axios";
import type { PublicClient } from "viem";
import { afterEach, expect, it } from "vitest";
import { createConfig } from "../core/config";
import { getTokenMarketData } from "./get-token-market-data/get-token-market-data";
import { getTokenMarketDataQueryOptions } from "./get-token-market-data/query";

const original = axios.defaults.adapter;
afterEach(() => {
  axios.defaults.adapter = original;
});
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 42161: { addresses: { affiliatesAddress: "0x0000000000000000000000000000000000000000" } } },
});
function respond(read: (url: string) => unknown) {
  const adapter: AxiosAdapter = async (request) => ({
    data: read(request.url!),
    status: 200,
    statusText: "OK",
    headers: {},
    config: request,
  });
  axios.defaults.adapter = adapter;
}
it("chooses the deepest matching base token on the requested chain and preserves missing values", async () => {
  respond(() => ({
    pairs: [
      { chainId: "base", baseToken: { address: "0xabc" }, liquidity: { usd: 10 }, info: { imageUrl: "icon" } },
      {
        chainId: "base",
        baseToken: { address: "0xabc" },
        liquidity: { usd: 20 },
        marketCap: 0,
        priceChange: { h24: -5 },
        pairAddress: "deep",
      },
      { chainId: "base", baseToken: { address: "0xdef" }, quoteToken: { address: "0xabc" }, liquidity: { usd: 9999 } },
      { chainId: "ethereum", baseToken: { address: "0xabc" }, liquidity: { usd: 9999 } },
    ],
  }));
  const [row] = await getTokenMarketData(config, {
    chainId: 42161,
    tokens: [{ address: "0xABC", tokenChainId: "base" }],
  });
  expect(row).toMatchObject({ pairAddress: "deep", liquidity: 20, marketCap: 0, imageUrl: "icon", priceChange24h: -5 });
  expect(row?.volume24h).toBeUndefined();
});
it("batches at 30 and preserves case-sensitive Solana identities", async () => {
  const sizes: number[] = [];
  respond((url) => {
    const addresses = url.split("/").at(-1)!.split(",");
    sizes.push(addresses.length);
    return { pairs: addresses.map((address) => ({ chainId: "solana", baseToken: { address }, pairAddress: address })) };
  });
  const tokens = Array.from({ length: 31 }, (_, i) => ({ address: `Token${i}`, tokenChainId: "solana" }));
  tokens.push({ address: "token0", tokenChainId: "solana" });
  const rows = await getTokenMarketData(config, { chainId: 42161, tokens });
  expect(sizes).toEqual([30, 2]);
  expect(rows).toHaveLength(32);
});
it("keeps token identity and deployment in query keys, separate from cache policy", () => {
  const tokens = [{ address: "0xabc", tokenChainId: "base" }];
  const a = getTokenMarketDataQueryOptions(config, { chainId: 42161, tokens, query: { staleTime: 60_000 } });
  const b = getTokenMarketDataQueryOptions(config, { chainId: 42161, tokens, query: { staleTime: 0 } });
  expect(a.queryKey).toEqual(b.queryKey);
  expect(a.staleTime).toBe(60_000);
  expect(a.queryKey).not.toEqual(
    getTokenMarketDataQueryOptions(config, { chainId: 42161, tokens: [{ ...tokens[0]!, tokenChainId: "ethereum" }] })
      .queryKey,
  );
});
it("retains successful enrichment batches only when partial results are requested", async () => {
  const tokens = Array.from({ length: 31 }, (_, index) => ({ address: `Token${index}`, tokenChainId: "solana" }));
  respond((url) => {
    if (url.endsWith("Token30")) throw new Error("one batch unavailable");
    return { pairs: [{ chainId: "solana", baseToken: { address: "Token0" }, liquidity: { usd: 10 } }] };
  });
  expect(await getTokenMarketData(config, { chainId: 42161, tokens, allowPartial: true })).toHaveLength(1);
  await expect(getTokenMarketData(config, { chainId: 42161, tokens })).rejects.toThrow("one batch unavailable");
});
