import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ApiContractSymbolsResponse } from "../types/generated/enigma-solver";

const getContractSymbols = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-solver")>();
  return {
    ...actual,
    getContractSymbols,
  };
});

import { getMarkets } from "./get-markets";

const SOLVER_URL = getDefaultSolver(SymmioSupportedChainId.HYPER_EVM).url;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

const SAMPLE_RESPONSE: { data: ApiContractSymbolsResponse } = {
  data: {
    count: 1,
    symbols: [
      {
        symbol_id: 1,
        name: "BTCUSDT",
        symbol: "BTC",
        asset: "BTC",
        state: 3,
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
  },
};

describe("getMarkets", () => {
  beforeEach(() => {
    getContractSymbols.mockReset();
  });

  it("requests the config's solver base URL and returns raw symbols", async () => {
    getContractSymbols.mockResolvedValue(SAMPLE_RESPONSE);

    const markets = await getMarkets(config, {});

    expect(getContractSymbols).toHaveBeenCalledWith(expect.objectContaining({ baseURL: SOLVER_URL }));
    expect(markets).toHaveLength(1);
    expect(markets[0]).toEqual(SAMPLE_RESPONSE.data.symbols![0]);
  });

  it("returns an empty array when the solver omits symbols", async () => {
    getContractSymbols.mockResolvedValue({ data: { count: 0 } });
    expect(await getMarkets(config, {})).toEqual([]);
  });

  it("wraps request failures in a SymmError", async () => {
    getContractSymbols.mockRejectedValue(new Error("Network error"));
    await expect(getMarkets(config, {})).rejects.toBeInstanceOf(SymmError);
    await expect(getMarkets(config, {})).rejects.toThrow("Failed to fetch markets");
  });
});
