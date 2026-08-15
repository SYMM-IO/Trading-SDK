import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SymbolsContract } from "../../types/generated/rasa-solver";

const getContractSymbolsContractSymbolsGet = vi.hoisted(() => vi.fn());

vi.mock("../../types/generated/rasa-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../types/generated/rasa-solver")>();
  return { ...actual, getContractSymbolsContractSymbolsGet };
});

import { fetchRasaMarkets, toRasaMarkets } from "./rasa-markets";

const raw: SymbolsContract = {
  price_precision: 2,
  quantity_precision: 3,
  name: "ETHUSDT",
  symbol: "ETH",
  asset: "ETH",
  symbol_id: 7,
  is_valid: true,
  min_acceptable_quote_value: "10",
  min_acceptable_portion_lf: "0.1",
  trading_fee: "0.0006",
  max_leverage: 50,
  max_notional_value: 500_000,
  rfq_allowed: true,
  hedger_fee_open: "0.0001",
  hedger_fee_close: "0.0002",
  max_funding_rate: "0.001",
  min_notional_value: "5",
  max_quantity: "1000",
  lot_size: "0.001",
};

describe("toRasaMarkets", () => {
  it("maps a record to a RasaMarket (camelCase, maxLeverage stays a number)", () => {
    expect(toRasaMarkets([raw])).toEqual([
      {
        kind: "rasa",
        symbolId: 7,
        name: "ETHUSDT",
        symbol: "ETH",
        asset: "ETH",
        isValid: true,
        pricePrecision: 2,
        quantityPrecision: 3,
        maxLeverage: 50,
        maxNotionalValue: 500_000,
        rfqAllowed: true,
        tradingFee: "0.0006",
        hedgerFeeOpen: "0.0001",
        hedgerFeeClose: "0.0002",
        maxFundingRate: "0.001",
        minNotionalValue: "5",
        maxQuantity: "1000",
        lotSize: "0.001",
        minAcceptableQuoteValue: "10",
        minAcceptablePortionLf: "0.1",
      },
    ]);
  });

  it("does not carry enigma-only fields", () => {
    const [market] = toRasaMarkets([raw]);
    expect(market).not.toHaveProperty("state");
    expect(market).not.toHaveProperty("side");
    expect(market).not.toHaveProperty("tokenAddress");
  });

  it("returns an empty array for an empty input", () => {
    expect(toRasaMarkets([])).toEqual([]);
  });
});

describe("fetchRasaMarkets", () => {
  beforeEach(() => getContractSymbolsContractSymbolsGet.mockReset());

  it("calls the rasa client with the base URL and normalizes the response", async () => {
    getContractSymbolsContractSymbolsGet.mockResolvedValue({ data: { count: 1, symbols: [raw] } });
    const markets = await fetchRasaMarkets("https://rasa.example/api");
    expect(getContractSymbolsContractSymbolsGet).toHaveBeenCalledWith({ baseURL: "https://rasa.example/api" });
    expect(markets).toHaveLength(1);
    expect(markets[0]).toMatchObject({ kind: "rasa", symbolId: 7, maxLeverage: 50 });
  });
});
