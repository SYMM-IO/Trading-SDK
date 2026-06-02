import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ApiContractSymbolsResponse } from "../solver/enigma-solver";
import { MarketState } from "./types";

vi.mock("../solver/axios-client", () => ({ axiosClient: vi.fn() }));

import { axiosClient } from "../solver/axios-client";
import { getMarkets } from "./get-markets";

const SOLVER_URL = getChainConfig(SymmioSupportedChainId.HYPER_EVM).solver.url;
const config = createConfig({ getClient: () => ({}) as PublicClient });

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
  beforeEach(() => {
    vi.mocked(axiosClient).mockReset();
  });

  it("requests the config's solver base URL and normalizes symbols", async () => {
    vi.mocked(axiosClient).mockResolvedValue(SAMPLE_RESPONSE);

    const markets = await getMarkets(config, {});

    expect(axiosClient).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: SOLVER_URL, url: "/contract-symbols", method: "GET" }),
    );
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

  it("returns an empty array when the solver omits symbols", async () => {
    vi.mocked(axiosClient).mockResolvedValue({ count: 0 });
    expect(await getMarkets(config, {})).toEqual([]);
  });

  it("wraps request failures in a SymmError", async () => {
    vi.mocked(axiosClient).mockRejectedValue(new Error("Network error"));
    await expect(getMarkets(config, {})).rejects.toBeInstanceOf(SymmError);
    await expect(getMarkets(config, {})).rejects.toThrow("Failed to fetch markets");
  });

  it("fills defaults for missing optional fields", async () => {
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
    vi.mocked(axiosClient).mockResolvedValue(responseWithMissing);

    const markets = await getMarkets(config, {});

    expect(markets[0]?.state).toBe(MarketState.FullyEnabled);
    expect(markets[0]?.rfqAllowed).toBe(false);
    expect(markets[0]?.lotSize).toBeUndefined();
  });
});
