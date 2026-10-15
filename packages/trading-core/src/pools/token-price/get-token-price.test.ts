import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { SymmApiError, SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { TokenPriceChain } from "../types";

const calculateSymbolPriceV2MarketTokenPricePost = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/listing-backend", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/listing-backend")>();
  return {
    ...actual,
    calculateSymbolPriceV2MarketTokenPricePost,
  };
});

import { getTokenPrice } from "./get-token-price";

const LISTING_URL = getChainConfig(SymmioSupportedChainId.ARBITRUM).listing?.url;
const TOKEN_ADDRESS = "0x648A000000000000000000000000000000000620a";

function axiosFailure(status: number, headers: Record<string, string> = {}): AxiosError {
  const err = new AxiosError("Request failed", String(status), undefined, undefined, {
    status,
    statusText: status === 401 ? "Unauthorized" : "Too Many Requests",
    headers: new AxiosHeaders(headers),
    config: { headers: new AxiosHeaders() },
    data: { detail: "nope" },
  });
  return err;
}

describe("getTokenPrice", () => {
  beforeEach(() => {
    calculateSymbolPriceV2MarketTokenPricePost.mockReset();
  });

  it("POSTs the chain name and token address, targets the listing endpoint with the bearer token, and normalizes the response", async () => {
    const { config } = mockConfig();
    calculateSymbolPriceV2MarketTokenPricePost.mockResolvedValue({ data: { price: 1.25 } });

    const estimate = await getTokenPrice(config, {
      accessToken: "TOKEN123",
      chain: TokenPriceChain.ARC,
      tokenAddress: TOKEN_ADDRESS,
    });

    expect(calculateSymbolPriceV2MarketTokenPricePost).toHaveBeenCalledWith(
      { chain: "ARC", token_address: TOKEN_ADDRESS },
      expect.objectContaining({
        baseURL: LISTING_URL,
        headers: { Authorization: "Bearer TOKEN123" },
      }),
    );

    expect(estimate).toEqual({ price: 1.25 });
  });

  it("throws LISTING_NOT_CONFIGURED before any request when the chain has no listing backend", async () => {
    const { config } = mockConfig();

    await expect(
      getTokenPrice(config, {
        chainId: SymmioSupportedChainId.BASE,
        accessToken: "t",
        chain: TokenPriceChain.BASE,
        tokenAddress: TOKEN_ADDRESS,
      }),
    ).rejects.toMatchObject({ kind: "config", code: "LISTING_NOT_CONFIGURED" });
    expect(calculateSymbolPriceV2MarketTokenPricePost).not.toHaveBeenCalled();
  });

  it("throws MISSING_ACCESS_TOKEN before any request when the access token is empty", async () => {
    const { config } = mockConfig();

    const call = getTokenPrice(config, {
      accessToken: "   ",
      chain: TokenPriceChain.SOLANA,
      tokenAddress: TOKEN_ADDRESS,
    });

    await expect(call).rejects.toBeInstanceOf(SymmError);
    await expect(call).rejects.toMatchObject({ kind: "validation", code: "MISSING_ACCESS_TOKEN" });
    expect(calculateSymbolPriceV2MarketTokenPricePost).not.toHaveBeenCalled();
  });

  it("throws UNSUPPORTED_TOKEN_PRICE_CHAIN before any request when the chain is not a TokenPriceChain", async () => {
    const { config } = mockConfig();

    const call = getTokenPrice(config, {
      accessToken: "TOKEN123",
      chain: "HYPER_EVM" as TokenPriceChain,
      tokenAddress: TOKEN_ADDRESS,
    });

    await expect(call).rejects.toBeInstanceOf(SymmError);
    await expect(call).rejects.toMatchObject({ kind: "validation", code: "UNSUPPORTED_TOKEN_PRICE_CHAIN" });
    expect(calculateSymbolPriceV2MarketTokenPricePost).not.toHaveBeenCalled();
  });

  it("surfaces a 401 as a SymmApiError carrying the status", async () => {
    const { config } = mockConfig();
    calculateSymbolPriceV2MarketTokenPricePost.mockRejectedValue(axiosFailure(401));

    const call = getTokenPrice(config, {
      accessToken: "expired",
      chain: TokenPriceChain.BSC,
      tokenAddress: TOKEN_ADDRESS,
    });

    await expect(call).rejects.toBeInstanceOf(SymmApiError);
    await expect(call).rejects.toMatchObject({ kind: "api", code: "FETCH_TOKEN_PRICE_FAILED", status: 401 });
  });

  it("surfaces a 429 with the service's Retry-After as retryAfterMs", async () => {
    const { config } = mockConfig();
    calculateSymbolPriceV2MarketTokenPricePost.mockRejectedValue(axiosFailure(429, { "retry-after": "30" }));

    await expect(
      getTokenPrice(config, {
        accessToken: "TOKEN123",
        chain: TokenPriceChain.SONIC,
        tokenAddress: TOKEN_ADDRESS,
      }),
    ).rejects.toMatchObject({ code: "FETCH_TOKEN_PRICE_FAILED", status: 429, retryAfterMs: 30_000 });
  });

  it("wraps a non-axios failure as a plain api SymmError", async () => {
    const { config } = mockConfig();
    calculateSymbolPriceV2MarketTokenPricePost.mockRejectedValue(new Error("socket hang up"));

    const call = getTokenPrice(config, {
      accessToken: "TOKEN123",
      chain: TokenPriceChain.ROBINHOOD,
      tokenAddress: TOKEN_ADDRESS,
    });

    await expect(call).rejects.toBeInstanceOf(SymmError);
    await expect(call).rejects.not.toBeInstanceOf(SymmApiError);
    await expect(call).rejects.toMatchObject({ kind: "api", code: "FETCH_TOKEN_PRICE_FAILED" });
  });
});
