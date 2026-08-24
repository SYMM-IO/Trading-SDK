import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiContractSymbol } from "../../types/generated/enigma-solver";

const getContractSymbols = vi.hoisted(() => vi.fn());

vi.mock("../../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../types/generated/enigma-solver")>();
  return { ...actual, getContractSymbols };
});

import { fetchEnigmaMarkets, toEnigmaMarkets } from "./enigma-markets";

describe("toEnigmaMarkets", () => {
  it("maps a full record to an EnigmaMarket (camelCase, maxLeverage coerced to number)", () => {
    const raw: ApiContractSymbol = {
      symbol_id: 1,
      name: "BTCUSDT",
      symbol: "BTC",
      asset: "BTC",
      is_valid: true,
      price_precision: 2,
      quantity_precision: 3,
      max_leverage: "125",
      max_notional_value: 1_000_000,
      rfq_allowed: true,
      trading_fee: "0.0006",
      hedger_fee_open: "0.0001",
      hedger_fee_close: "0.0002",
      max_funding_rate: "0.001",
      min_notional_value: "5",
      max_quantity: "100",
      lot_size: "0.001",
      min_acceptable_quote_value: "10",
      min_acceptable_portion_lf: "0.1",
      side: "all",
      state: 3,
      token_address: "0xabc",
      funding_rate_epoch_duration: "3600",
      funding_rate_window_time: "60",
    };

    expect(toEnigmaMarkets([raw])).toEqual([
      {
        kind: "enigma",
        symbolId: 1,
        name: "BTCUSDT",
        symbol: "BTC",
        asset: "BTC",
        isValid: true,
        pricePrecision: 2,
        quantityPrecision: 3,
        maxLeverage: 125,
        maxNotionalValue: 1_000_000,
        rfqAllowed: true,
        tradingFee: "0.0006",
        hedgerFeeOpen: "0.0001",
        hedgerFeeClose: "0.0002",
        maxFundingRate: "0.001",
        minNotionalValue: "5",
        maxQuantity: "100",
        lotSize: "0.001",
        minAcceptableQuoteValue: "10",
        minAcceptablePortionLf: "0.1",
        side: "all",
        state: 3,
        tokenAddress: "0xabc",
        fundingRateEpochDuration: "3600",
        fundingRateWindowTime: "60",
      },
    ]);
  });

  it("fills every enigma-optional gap with a neutral default (identity fields present)", () => {
    const [market] = toEnigmaMarkets([{ symbol_id: 2, name: "X", symbol: "X" }]);
    expect(market).toEqual({
      kind: "enigma",
      symbolId: 2,
      name: "X",
      symbol: "X",
      asset: "",
      isValid: false,
      pricePrecision: 0,
      quantityPrecision: 0,
      maxLeverage: 0,
      maxNotionalValue: 0,
      rfqAllowed: false,
      tradingFee: "0",
      hedgerFeeOpen: "0",
      hedgerFeeClose: "0",
      maxFundingRate: "0",
      minNotionalValue: "0",
      maxQuantity: "0",
      lotSize: "0",
      minAcceptableQuoteValue: "0",
      minAcceptablePortionLf: "0",
      side: "",
      state: 0,
      tokenAddress: "",
      fundingRateEpochDuration: "0",
      fundingRateWindowTime: "0",
    });
  });

  it("coerces a missing maxLeverage to 0, never NaN", () => {
    const [market] = toEnigmaMarkets([{ symbol_id: 1, name: "X", symbol: "X" }]);
    expect(market?.maxLeverage).toBe(0);
    expect(Number.isNaN(market?.maxLeverage)).toBe(false);
  });

  it.each([
    ["missing symbol_id", { name: "X", symbol: "X" }],
    ["missing name", { symbol_id: 1, symbol: "X" }],
    ["missing symbol", { symbol_id: 1, name: "X" }],
  ])("skips a row %s", (_label, raw) => {
    expect(toEnigmaMarkets([raw as ApiContractSymbol])).toEqual([]);
  });

  it("keeps identified rows and drops unidentified ones in the same batch", () => {
    const good: ApiContractSymbol = { symbol_id: 9, name: "OK", symbol: "OK" };
    const bad: ApiContractSymbol = { name: "no id" };
    const markets = toEnigmaMarkets([bad, good]);
    expect(markets).toHaveLength(1);
    expect(markets[0]?.symbolId).toBe(9);
  });

  it("returns an empty array for an empty input", () => {
    expect(toEnigmaMarkets([])).toEqual([]);
  });
});

describe("fetchEnigmaMarkets", () => {
  beforeEach(() => getContractSymbols.mockReset());

  it("calls the enigma client with the base URL and normalizes the response", async () => {
    getContractSymbols.mockResolvedValue({
      data: { symbols: [{ symbol_id: 1, name: "BTCUSDT", symbol: "BTC", max_leverage: "125" }] },
    });
    const markets = await fetchEnigmaMarkets("https://enigma.example/api");
    expect(getContractSymbols).toHaveBeenCalledWith({ baseURL: "https://enigma.example/api" });
    expect(markets).toHaveLength(1);
    expect(markets[0]).toMatchObject({ kind: "enigma", symbolId: 1, maxLeverage: 125 });
  });

  it("returns an empty array when the solver omits symbols", async () => {
    getContractSymbols.mockResolvedValue({ data: {} });
    expect(await fetchEnigmaMarkets("u")).toEqual([]);
  });
});
