import type { PublicClient } from "viem";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { getDefaultSolver, SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { SymmError } from "../../shared/errors/symm-error";
import type { ApiContractSymbolsResponse } from "../types/generated/enigma-solver";
import type { SymbolsContractResponseSchema } from "../types/generated/rasa-solver";
import type { EnigmaMarket, Market, RasaMarket } from "./types";

const getContractSymbols = vi.hoisted(() => vi.fn());
const getContractSymbolsContractSymbolsGet = vi.hoisted(() => vi.fn());

vi.mock("../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/enigma-solver")>();
  return { ...actual, getContractSymbols };
});

vi.mock("../types/generated/rasa-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../types/generated/rasa-solver")>();
  return { ...actual, getContractSymbolsContractSymbolsGet };
});

import { getMarkets, type GetMarketsReturnType } from "./get-markets";

const ENIGMA_URL = getDefaultSolver(SymmioSupportedChainId.HYPER_EVM).url;
const RASA_URL = getDefaultSolver(SymmioSupportedChainId.BASE).url;
const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

const ENIGMA_RESPONSE: { data: ApiContractSymbolsResponse } = {
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

const RASA_RESPONSE: { data: SymbolsContractResponseSchema } = {
  data: {
    count: 1,
    symbols: [
      {
        symbol_id: 7,
        name: "ETHUSDT",
        symbol: "ETH",
        asset: "ETH",
        is_valid: true,
        rfq_allowed: true,
        price_precision: 2,
        quantity_precision: 3,
        trading_fee: "0.0006",
        max_leverage: 50,
        max_notional_value: 500000,
        max_funding_rate: "0.001",
        min_acceptable_quote_value: "10",
        min_acceptable_portion_lf: "0.1",
        hedger_fee_open: "0.0001",
        hedger_fee_close: "0.0001",
        min_notional_value: "5",
        max_quantity: "1000",
        lot_size: "0.001",
      },
    ],
  },
};

describe("getMarkets", () => {
  beforeEach(() => {
    getContractSymbols.mockReset();
    getContractSymbolsContractSymbolsGet.mockReset();
  });

  describe("enigma solver", () => {
    it("fetches the enigma base URL and normalizes to an EnigmaMarket", async () => {
      getContractSymbols.mockResolvedValue(ENIGMA_RESPONSE);

      const markets = await getMarkets(config, { solverId: "enigma" });

      expect(getContractSymbols).toHaveBeenCalledWith(expect.objectContaining({ baseURL: ENIGMA_URL }));
      expect(markets).toHaveLength(1);
      expect(markets[0]).toMatchObject({
        kind: "enigma",
        symbolId: 1,
        name: "BTCUSDT",
        symbol: "BTC",
        state: 3,
        tradingFee: "0.0006",
      });
      // maxLeverage is coerced from the enigma string to a number.
      expect(markets[0]?.maxLeverage).toBe(125);
      // enigma-only fields absent from the response fall back to neutral defaults.
      expect(markets[0]?.side).toBe("");
      expect(markets[0]?.maxQuantity).toBe("0");
    });

    it("skips rows missing an identity field", async () => {
      getContractSymbols.mockResolvedValue({
        data: { symbols: [{ name: "no id", symbol: "X" }, ENIGMA_RESPONSE.data.symbols![0]] },
      });

      const markets = await getMarkets(config, { solverId: "enigma" });

      expect(markets).toHaveLength(1);
      expect(markets[0]?.symbolId).toBe(1);
    });

    it("returns an empty array when the solver omits symbols", async () => {
      getContractSymbols.mockResolvedValue({ data: { count: 0 } });
      expect(await getMarkets(config, { solverId: "enigma" })).toEqual([]);
    });
  });

  describe("rasa solver", () => {
    it("fetches the rasa base URL and normalizes to a RasaMarket", async () => {
      getContractSymbolsContractSymbolsGet.mockResolvedValue(RASA_RESPONSE);

      const markets = await getMarkets(config, { chainId: SymmioSupportedChainId.BASE, solverId: "rasa" });

      expect(getContractSymbolsContractSymbolsGet).toHaveBeenCalledWith(expect.objectContaining({ baseURL: RASA_URL }));
      expect(markets).toHaveLength(1);
      expect(markets[0]).toMatchObject({
        kind: "rasa",
        symbolId: 7,
        name: "ETHUSDT",
        maxLeverage: 50,
        maxQuantity: "1000",
      });
      // Rasa markets carry no enigma-only fields.
      expect("state" in (markets[0] ?? {})).toBe(false);
    });
  });

  it("wraps request failures in a SymmError", async () => {
    getContractSymbols.mockRejectedValue(new Error("Network error"));
    await expect(getMarkets(config, { solverId: "enigma" })).rejects.toBeInstanceOf(SymmError);
    await expect(getMarkets(config, { solverId: "enigma" })).rejects.toThrow("Failed to fetch markets");
  });
});

describe("getMarkets — return type narrowing", () => {
  it("maps each solver kind to its normalized market array", () => {
    expectTypeOf<GetMarketsReturnType<"enigma">>().toEqualTypeOf<EnigmaMarket[]>();
    expectTypeOf<GetMarketsReturnType<"rasa">>().toEqualTypeOf<RasaMarket[]>();
    // Default type argument (omitted / a runtime kind) is the Market union.
    expectTypeOf<GetMarketsReturnType>().toEqualTypeOf<Market[]>();
  });

  it("narrows the return from a literal solverId at the call site (compile-time only)", () => {
    // Never executed — tsc still type-checks the body, so this guards that a
    // literal `solverId` binds the generic and a variable widens to the union.
    const probe = () => {
      expectTypeOf(getMarkets(config, { solverId: "rasa" })).resolves.toEqualTypeOf<RasaMarket[]>();
      expectTypeOf(getMarkets(config, { solverId: "enigma" })).resolves.toEqualTypeOf<EnigmaMarket[]>();
      expectTypeOf(getMarkets(config, {})).resolves.toEqualTypeOf<Market[]>();
    };
    expect(typeof probe).toBe("function");
  });
});
