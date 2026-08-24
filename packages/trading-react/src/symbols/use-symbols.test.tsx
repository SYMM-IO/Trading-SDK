import type { GetSymbolsReturnType } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";

const getSymbolsQueryOptions = vi.hoisted(() => vi.fn());

vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, getSymbolsQueryOptions };
});

import { useSymbols } from "./use-symbols";

const RESULT = [
  {
    symbolId: 1,
    name: "BTCUSDT",
    symbol: "BTC",
    asset: "BTC",
    isValid: true,
    pricePrecision: 1,
    quantityPrecision: 3,
    maxLeverage: 100,
    maxNotionalValue: 0,
    rfqAllowed: true,
    tradingFee: "0",
    hedgerFeeOpen: "0",
    hedgerFeeClose: "0",
    maxFundingRate: "0",
    minNotionalValue: "0",
    maxQuantity: "0",
    lotSize: "0",
    minAcceptableQuoteValue: "0",
    minAcceptablePortionLf: "0",
    tokenAddress: "",
    fundingRateEpochDuration: "0",
    fundingRateWindowTime: "0",
    stateLong: 3,
    stateShort: 3,
  },
] satisfies GetSymbolsReturnType;

function mockOptions(queryFn: () => Promise<unknown>) {
  getSymbolsQueryOptions.mockReturnValue({
    queryKey: ["getSymbols", {}],
    enabled: true,
    queryFn,
  });
}

describe("useSymbols", () => {
  afterEach(() => {
    getSymbolsQueryOptions.mockReset();
  });

  it("wires the connected chain into the core query options and returns data", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    const { result } = renderHookWithProviders(() => useSymbols({ config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(RESULT);
    expect(getSymbolsQueryOptions).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ chainId: expect.any(Number) }),
    );
  });

  it("forwards the search filter into the core query options", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockResolvedValue(RESULT));

    renderHookWithProviders(() => useSymbols({ config, search: "BTC" }));

    await waitFor(() => expect(getSymbolsQueryOptions).toHaveBeenCalled());
    expect(getSymbolsQueryOptions).toHaveBeenCalledWith(config, expect.objectContaining({ search: "BTC" }));
  });

  it("normalizes a fetch failure to a SymmioRequestError", async () => {
    const { config } = createMockSymmioConfig();
    mockOptions(vi.fn().mockRejectedValue(new Error("solver down")));

    const { result } = renderHookWithProviders(() => useSymbols({ config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toHaveProperty("kind");
  });
});
