import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SymmError } from "../errors";
import type { ApiContractSymbolsResponse } from "../solver/enigma-solver";
import { getMarkets } from "./get-markets";
import { MarketState } from "./types";

vi.mock("../solver/axios-client", () => ({
  setSolverBaseUrl: vi.fn(),
  axiosClient: vi.fn(),
}));

vi.mock("../solver/enigma-solver", async (importOriginal) => {
  const original = await importOriginal<typeof import("../solver/enigma-solver")>();
  return {
    ...original,
    getLowCapSolverAPI: vi.fn(),
  };
});

import { setSolverBaseUrl } from "../solver/axios-client";
import { getLowCapSolverAPI } from "../solver/enigma-solver";

const SOLVER_URL = "https://solver.example.com/api";

const SAMPLE_RESPONSE: ApiContractSymbolsResponse = {
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
      trading_fee: "0.0006",
      max_leverage: "125",
      max_notional_value: 1000000,
      max_funding_rate: "0.001",
      min_acceptable_quote_value: "10",
      min_acceptable_portion_lf: "0.1",
      hedger_fee_open: "0.0001",
      hedger_fee_close: "0.0001",
      min_notional_value: "5",
      lot_size: "0.001",
    },
  ],
};

describe("getMarkets", () => {
  const mockGetContractSymbols = vi.fn();

  beforeEach(() => {
    vi.mocked(getLowCapSolverAPI).mockReturnValue({
      getContractSymbols: mockGetContractSymbols,
    } as unknown as ReturnType<typeof getLowCapSolverAPI>);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sets solver base URL and fetches contract symbols", async () => {
    mockGetContractSymbols.mockResolvedValue(SAMPLE_RESPONSE);

    const markets = await getMarkets(SOLVER_URL);

    expect(setSolverBaseUrl).toHaveBeenCalledWith(SOLVER_URL);
    expect(mockGetContractSymbols).toHaveBeenCalled();
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

  it("throws SymmError on network failure", async () => {
    mockGetContractSymbols.mockRejectedValue(new Error("Network error"));

    await expect(getMarkets(SOLVER_URL)).rejects.toBeInstanceOf(SymmError);
    await expect(getMarkets(SOLVER_URL)).rejects.toThrow("Failed to fetch markets");
  });

  it("throws SymmError when symbols array is missing", async () => {
    mockGetContractSymbols.mockResolvedValue({ count: 0 });

    await expect(getMarkets(SOLVER_URL)).rejects.toBeInstanceOf(SymmError);
    await expect(getMarkets(SOLVER_URL)).rejects.toThrow("missing symbols array");
  });

  it("handles missing optional fields with defaults", async () => {
    const responseWithMissing: ApiContractSymbolsResponse = {
      count: 1,
      symbols: [
        {
          symbol_id: 2,
          name: "ETHUSDT",
          symbol: "ETH",
          asset: "ETH",
          state: undefined,
          is_valid: true,
          rfq_allowed: undefined,
          price_precision: 2,
          quantity_precision: 4,
          trading_fee: "0.0005",
          max_leverage: "100",
          max_notional_value: 500000,
          max_funding_rate: "0.0005",
          min_acceptable_quote_value: "5",
          min_acceptable_portion_lf: "0.1",
          hedger_fee_open: "0.0001",
          hedger_fee_close: "0.0001",
          min_notional_value: "10",
        },
      ],
    };

    mockGetContractSymbols.mockResolvedValue(responseWithMissing);

    const markets = await getMarkets(SOLVER_URL);

    expect(markets[0]?.state).toBe(MarketState.FullyEnabled);
    expect(markets[0]?.rfqAllowed).toBe(false);
    expect(markets[0]?.lotSize).toBeUndefined();
  });
});
