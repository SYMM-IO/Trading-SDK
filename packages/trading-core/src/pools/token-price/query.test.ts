import { describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import { TokenPriceChain } from "../types";

const getTokenPrice = vi.hoisted(() => vi.fn());

vi.mock("./get-token-price", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./get-token-price")>();
  return { ...actual, getTokenPrice };
});

import { getTokenPriceQueryKey, getTokenPriceQueryOptions } from "./query";

const TOKEN = "0x648A000000000000000000000000000000000620a";
const ACCESS_TOKEN = "eyJhbGc.header.sig";
const FIVE_MINUTES_MS = 5 * 60 * 1000;

describe("getTokenPriceQueryKey", () => {
  it("tags the key with the action name and carries the chain and token address", () => {
    const key = getTokenPriceQueryKey({
      accessToken: ACCESS_TOKEN,
      chain: TokenPriceChain.ARC,
      tokenAddress: TOKEN,
      configKey: "k",
    });

    expect(key[0]).toBe("getTokenPrice");
    expect(key[1]).toMatchObject({ chain: TokenPriceChain.ARC, tokenAddress: TOKEN, configKey: "k" });
  });

  it("keeps the bearer token out of the devtools-visible key", () => {
    const key = getTokenPriceQueryKey({
      accessToken: ACCESS_TOKEN,
      chain: TokenPriceChain.ARC,
      tokenAddress: TOKEN,
      configKey: "k",
    });

    expect(key[1]).not.toHaveProperty("accessToken");
    expect(JSON.stringify(key)).not.toContain(ACCESS_TOKEN);
  });

  it("is identical across a token refresh, so a re-login hits the same cache entry", () => {
    const params = { chain: TokenPriceChain.BASE, tokenAddress: TOKEN, configKey: "k" };

    expect(getTokenPriceQueryKey({ ...params, accessToken: "first" })).toEqual(
      getTokenPriceQueryKey({ ...params, accessToken: "second" }),
    );
  });

  it("separates the same address on two chains", () => {
    const params = { accessToken: ACCESS_TOKEN, tokenAddress: TOKEN, configKey: "k" };

    expect(getTokenPriceQueryKey({ ...params, chain: TokenPriceChain.BASE })).not.toEqual(
      getTokenPriceQueryKey({ ...params, chain: TokenPriceChain.SOLANA }),
    );
  });
});

describe("getTokenPriceQueryOptions", () => {
  it("is enabled by default, caches for five minutes, and wires the action", () => {
    const { config } = mockConfig();
    const options = getTokenPriceQueryOptions(config, {
      accessToken: ACCESS_TOKEN,
      chain: TokenPriceChain.ARC,
      tokenAddress: TOKEN,
    });

    expect(options.enabled).toBe(true);
    expect(options.staleTime).toBe(FIVE_MINUTES_MS);
    expect(options.gcTime).toBe(FIVE_MINUTES_MS);
    expect(options.queryKey[0]).toBe("getTokenPrice");
    expect(typeof options.queryFn).toBe("function");
  });

  it("lets a query override win over the five-minute defaults", () => {
    const { config } = mockConfig();
    const options = getTokenPriceQueryOptions(config, {
      accessToken: ACCESS_TOKEN,
      chain: TokenPriceChain.ARC,
      tokenAddress: TOKEN,
      query: { staleTime: 0, gcTime: 1_000, enabled: false },
    });

    expect(options.staleTime).toBe(0);
    expect(options.gcTime).toBe(1_000);
    expect(options.enabled).toBe(false);
  });

  it("forwards every action parameter from queryFn", async () => {
    const { config } = mockConfig();
    getTokenPrice.mockResolvedValue({ price: 2 });
    const options = getTokenPriceQueryOptions(config, {
      chainId: 42161,
      accessToken: ACCESS_TOKEN,
      chain: TokenPriceChain.ARC,
      tokenAddress: TOKEN,
    });

    await expect(options.queryFn()).resolves.toEqual({ price: 2 });
    expect(getTokenPrice).toHaveBeenCalledWith(config, {
      chainId: 42161,
      accessToken: ACCESS_TOKEN,
      chain: TokenPriceChain.ARC,
      tokenAddress: TOKEN,
    });
  });
});
