import { ListingDepositChainId, type GetListingMarketDetailReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getListingMarketDetailQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getListingMarketDetailQueryOptions };
});

import { useListingMarketDetail } from "./use-listing-market-detail";

const TOKEN = "0x800822d361335b4d5F352Dac293cA4128b5B605f";

/** Only the fields this hook test reads; `toListingMarketDetail` covers the full shape. */
const DETAIL = { tokenTicker: "SYMM", symbolId: 1 } as unknown as GetListingMarketDetailReturnType;

function mockOptions(queryFn: () => Promise<unknown>, enabled = true) {
  getListingMarketDetailQueryOptions.mockReturnValue({ queryKey: ["getListingMarketDetail", {}], enabled, queryFn });
}

describe("useListingMarketDetail", () => {
  afterEach(() => {
    getListingMarketDetailQueryOptions.mockReset();
  });

  it("addresses the pool by token and deposit chain, since one token can be listed from several", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(DETAIL));

    const { result } = renderHookWithProviders(() =>
      useListingMarketDetail({ config, tokenContractAddress: TOKEN, depositChain: ListingDepositChainId.BASE }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(DETAIL);
    expect(getListingMarketDetailQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({
        tokenContractAddress: TOKEN,
        depositChain: ListingDepositChainId.BASE,
        chainId: expect.any(Number),
      }),
    );
  });

  it("stays idle when the caller disables the query", async () => {
    const { config } = createMockSymmioConfig();
    const queryFn = vi.fn().mockResolvedValue(DETAIL);
    mockOptions(queryFn, false);

    const { result } = renderHookWithProviders(() =>
      useListingMarketDetail({
        config,
        tokenContractAddress: "",
        depositChain: ListingDepositChainId.BASE,
        query: { enabled: false },
      }),
    );

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(queryFn).not.toHaveBeenCalled();
  });

  it("normalizes a thrown error into a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("boom")));

    const { result } = renderHookWithProviders(() =>
      useListingMarketDetail({ config, tokenContractAddress: TOKEN, depositChain: ListingDepositChainId.BASE }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
