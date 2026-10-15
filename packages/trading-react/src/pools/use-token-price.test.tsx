import { TokenPriceChain, type GetTokenPriceReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getTokenPriceQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getTokenPriceQueryOptions };
});

import { useTokenPrice } from "./use-token-price";

const TOKEN_ADDRESS = "0x648A000000000000000000000000000000000620a";

const ESTIMATE: GetTokenPriceReturnType = { price: 0.0042 };

function mockOptions(queryFn: () => Promise<unknown>) {
  getTokenPriceQueryOptions.mockReturnValue({
    queryKey: ["getTokenPrice", {}],
    enabled: true,
    queryFn,
  });
}

describe("useTokenPrice", () => {
  afterEach(() => {
    getTokenPriceQueryOptions.mockReset();
  });

  it("forwards the access token, chain, token address and connected chain into the core query options and returns the estimate", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(ESTIMATE));

    const { result } = renderHookWithProviders(() =>
      useTokenPrice({
        config,
        accessToken: "tok-abc",
        chain: TokenPriceChain.ARC,
        tokenAddress: TOKEN_ADDRESS,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(ESTIMATE);
    expect(getTokenPriceQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        accessToken: "tok-abc",
        chain: TokenPriceChain.ARC,
        tokenAddress: TOKEN_ADDRESS,
        chainId: expect.any(Number),
      }),
    );
  });

  it("stays idle when the access token is empty", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(ESTIMATE);
    mockOptions(queryFn);

    const { result } = renderHookWithProviders(() =>
      useTokenPrice({
        config,
        accessToken: "",
        chain: TokenPriceChain.ARC,
        tokenAddress: TOKEN_ADDRESS,
      }),
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(result.current.isPending).toBe(true);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("stays idle when the token address is empty", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(ESTIMATE);
    mockOptions(queryFn);

    const { result } = renderHookWithProviders(() =>
      useTokenPrice({
        config,
        accessToken: "tok-abc",
        chain: TokenPriceChain.ARC,
        tokenAddress: "",
      }),
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(result.current.isPending).toBe(true);
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() =>
      useTokenPrice({
        config,
        accessToken: "tok-abc",
        chain: TokenPriceChain.ARC,
        tokenAddress: TOKEN_ADDRESS,
      }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
