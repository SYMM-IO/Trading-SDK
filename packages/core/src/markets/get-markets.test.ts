import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SymmError } from "../errors";
import { getMarkets } from "./get-markets";
import type { ContractSymbolsResponse } from "./types";
import { MarketState } from "./types";

const SOLVER_URL = "https://solver.example.com/api";

const SAMPLE_RESPONSE: ContractSymbolsResponse = {
  count: 1,
  symbols: [
    {
      symbol_id: 1,
      name: "BTCUSDT",
      symbol: "BTC",
      asset: "BTC",
      state: MarketState.FullyEnabled,
      is_valid: true,
      rfq_allowed: true,
      price_precision: 2,
      quantity_precision: 3,
      trading_fee: 0.0006,
      max_leverage: 125,
      max_notional_value: 1000000,
      max_funding_rate: 0.001,
      min_acceptable_quote_value: 10,
      min_acceptable_portion_lf: 0.1,
      hedger_fee_open: "0.0001",
      hedger_fee_close: "0.0001",
      min_notional_value: "5",
      lot_size: "0.001",
    },
  ],
};

describe("getMarkets", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches and transforms contract symbols", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(SAMPLE_RESPONSE),
    } as Response);

    const markets = await getMarkets(SOLVER_URL);

    expect(fetch).toHaveBeenCalledWith(`${SOLVER_URL}/contract-symbols`);
    expect(markets).toHaveLength(1);
    expect(markets[0]).toEqual({
      id: 1,
      name: "BTCUSDT",
      symbol: "BTC",
      asset: "BTC",
      state: MarketState.FullyEnabled,
      isValid: true,
      rfqAllowed: true,
      pricePrecision: 2,
      quantityPrecision: 3,
      tradingFee: 0.0006,
      maxLeverage: 125,
      maxNotionalValue: 1000000,
      maxFundingRate: "0.001",
      minAcceptableQuoteValue: 10,
      minAcceptablePortionLF: 0.1,
      hedgerFeeOpen: "0.0001",
      hedgerFeeClose: "0.0001",
      minNotionalValue: 5,
      lotSize: 0.001,
    });
  });

  it("handles trailing slash in solver URL", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ count: 0, symbols: [] }),
    } as Response);

    await getMarkets(`${SOLVER_URL}/`);

    expect(fetch).toHaveBeenCalledWith(`${SOLVER_URL}/contract-symbols`);
  });

  it("throws SymmError on network failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    await expect(getMarkets(SOLVER_URL)).rejects.toBeInstanceOf(SymmError);
    await expect(getMarkets(SOLVER_URL)).rejects.toThrow("Failed to fetch markets");
  });

  it("throws SymmError on non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(getMarkets(SOLVER_URL)).rejects.toBeInstanceOf(SymmError);
    await expect(getMarkets(SOLVER_URL)).rejects.toThrow("500");
  });

  it("throws SymmError on invalid JSON", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error("Invalid JSON")),
    } as Response);

    await expect(getMarkets(SOLVER_URL)).rejects.toBeInstanceOf(SymmError);
    await expect(getMarkets(SOLVER_URL)).rejects.toThrow("Invalid JSON");
  });

  it("throws SymmError when symbols array is missing", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ count: 0 }),
    } as Response);

    await expect(getMarkets(SOLVER_URL)).rejects.toBeInstanceOf(SymmError);
    await expect(getMarkets(SOLVER_URL)).rejects.toThrow("missing symbols array");
  });

  it("handles missing optional fields with defaults", async () => {
    const responseWithMissing: ContractSymbolsResponse = {
      count: 1,
      symbols: [
        {
          symbol_id: 2,
          name: "ETHUSDT",
          symbol: "ETH",
          asset: "ETH",
          state: undefined as unknown as MarketState,
          is_valid: true,
          rfq_allowed: undefined as unknown as boolean,
          price_precision: 2,
          quantity_precision: 4,
          trading_fee: 0.0005,
          max_leverage: 100,
          max_notional_value: 500000,
          max_funding_rate: 0.0005,
          min_acceptable_quote_value: 5,
          min_acceptable_portion_lf: 0.1,
          hedger_fee_open: "0.0001",
          hedger_fee_close: "0.0001",
          min_notional_value: "10",
        },
      ],
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseWithMissing),
    } as Response);

    const markets = await getMarkets(SOLVER_URL);

    expect(markets[0]?.state).toBe(MarketState.FullyEnabled);
    expect(markets[0]?.rfqAllowed).toBe(false);
    expect(markets[0]?.lotSize).toBeUndefined();
  });
});
