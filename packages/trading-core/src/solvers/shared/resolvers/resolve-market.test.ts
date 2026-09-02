import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains/supported-chains";
import { createConfig } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";

const getContractSymbols = vi.hoisted(() => vi.fn());
const getContractSymbolsContractSymbolsGet = vi.hoisted(() => vi.fn());

vi.mock("../../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../types/generated/enigma-solver")>();
  return { ...actual, getContractSymbols };
});

vi.mock("../../types/generated/rasa-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../types/generated/rasa-solver")>();
  return { ...actual, getContractSymbolsContractSymbolsGet };
});

import { resolveMarket } from "./resolve-market";

const AFFILIATE = "0x000000000000000000000000000000000000aFF1";

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { [SymmioSupportedChainId.HYPER_EVM]: { addresses: { affiliatesAddress: AFFILIATE } } },
});

/**
 * A chain registering BOTH solver kinds — the configuration that makes a
 * dropped `solverId` observable. With one solver per chain the default resolves
 * to the same solver either way, which is why this defect stayed latent.
 */
const multiSolverConfig = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.BASE]: {
      addresses: { affiliatesAddress: AFFILIATE },
      defaultSolverId: "enigma",
      solvers: {
        enigma: {
          name: "Enigma",
          address: AFFILIATE,
          url: "https://enigma.test",
          notifications: { url: "wss://enigma.test/ws", protocol: "enigma", channel: "test" },
        },
        rasa: { name: "Rasa", address: AFFILIATE, url: "https://rasa.test" },
      },
    },
  },
});

const MARKET = { symbol_id: 1, name: "BTCUSDT", symbol: "BTC", price_precision: 2, quantity_precision: 3 };

/** Rasa's spec marks every field required, so its adapter maps them without defaults. */
const RASA_MARKET = {
  symbol_id: 1,
  name: "ETHUSDT",
  symbol: "ETH",
  asset: "USDT",
  is_valid: true,
  price_precision: 7,
  quantity_precision: 8,
  max_leverage: 10,
  max_notional_value: 350000,
  rfq_allowed: true,
  trading_fee: "0.0012",
  hedger_fee_open: "0",
  hedger_fee_close: "0",
  max_funding_rate: "200",
  min_notional_value: "7.5",
  max_quantity: "20000000",
  lot_size: "1",
  min_acceptable_quote_value: "15.0",
  min_acceptable_portion_lf: "0.004",
};

describe("resolveMarket", () => {
  beforeEach(() => {
    getContractSymbols.mockReset();
    getContractSymbolsContractSymbolsGet.mockReset();
  });

  it("returns caller-supplied metadata without fetching when all three are provided", async () => {
    const result = await resolveMarket(config, {
      marketId: 1,
      marketName: "FOO",
      pricePrecision: 4,
      quantityPrecision: 5,
    });
    expect(result).toEqual({ name: "FOO", pricePrecision: 4, quantityPrecision: 5 });
    expect(getContractSymbols).not.toHaveBeenCalled();
  });

  it("fetches and extracts metadata for the matching market id", async () => {
    getContractSymbols.mockResolvedValue({ data: { symbols: [MARKET] } });
    const result = await resolveMarket(config, { marketId: 1 });
    expect(result).toEqual({ name: "BTCUSDT", pricePrecision: 2, quantityPrecision: 3 });
  });

  it("throws RESOLVE_MARKET_NOT_FOUND when no market matches", async () => {
    getContractSymbols.mockResolvedValue({ data: { symbols: [MARKET] } });
    await expect(resolveMarket(config, { marketId: 999 })).rejects.toBeInstanceOf(SymmError);
    await expect(resolveMarket(config, { marketId: 999 })).rejects.toThrow(/not returned by solver/);
  });

  it("prefers a caller-supplied name but fills precision from the solver", async () => {
    getContractSymbols.mockResolvedValue({ data: { symbols: [MARKET] } });
    const result = await resolveMarket(config, { marketId: 1, marketName: "Custom" });
    expect(result).toEqual({ name: "Custom", pricePrecision: 2, quantityPrecision: 3 });
  });

  it("reads the targeted solver's listing, not the chain default's", async () => {
    getContractSymbols.mockResolvedValue({ data: { symbols: [MARKET] } });
    getContractSymbolsContractSymbolsGet.mockResolvedValue({ data: { symbols: [RASA_MARKET] } });

    const result = await resolveMarket(multiSolverConfig, {
      chainId: SymmioSupportedChainId.BASE,
      solverId: "rasa",
      marketId: 1,
    });

    expect(result).toEqual({ name: "ETHUSDT", pricePrecision: 7, quantityPrecision: 8 });
    expect(getContractSymbolsContractSymbolsGet).toHaveBeenCalledWith({ baseURL: "https://rasa.test" });
    expect(getContractSymbols).not.toHaveBeenCalled();
  });

  it("falls back to the chain's default solver when solverId is omitted", async () => {
    getContractSymbols.mockResolvedValue({ data: { symbols: [MARKET] } });
    getContractSymbolsContractSymbolsGet.mockResolvedValue({ data: { symbols: [RASA_MARKET] } });

    const result = await resolveMarket(multiSolverConfig, { chainId: SymmioSupportedChainId.BASE, marketId: 1 });

    expect(result).toEqual({ name: "BTCUSDT", pricePrecision: 2, quantityPrecision: 3 });
    expect(getContractSymbols).toHaveBeenCalledWith({ baseURL: "https://enigma.test" });
    expect(getContractSymbolsContractSymbolsGet).not.toHaveBeenCalled();
  });

  it("short-circuits with includeSolverFeeCaps only when the caps are pre-filled too", async () => {
    const result = await resolveMarket(config, {
      marketId: 1,
      marketName: "FOO",
      pricePrecision: 4,
      quantityPrecision: 5,
      minOpenSolverFeeCap: "0.0005",
      minCloseSolverFeeCap: "0.0003",
      includeSolverFeeCaps: true,
    });

    expect(result).toEqual({
      name: "FOO",
      pricePrecision: 4,
      quantityPrecision: 5,
      minOpenSolverFeeCap: "0.0005",
      minCloseSolverFeeCap: "0.0003",
    });
    expect(getContractSymbols).not.toHaveBeenCalled();
  });

  it("fetches for the caps even when the metadata is pre-filled, and reads them from the enigma row", async () => {
    getContractSymbols.mockResolvedValue({
      data: { symbols: [{ ...MARKET, min_open_solver_fee_cap: "0.0005", min_close_solver_fee_cap: "0.0003" }] },
    });

    const result = await resolveMarket(config, {
      marketId: 1,
      marketName: "FOO",
      pricePrecision: 4,
      quantityPrecision: 5,
      includeSolverFeeCaps: true,
    });

    expect(result).toEqual({
      name: "FOO",
      pricePrecision: 4,
      quantityPrecision: 5,
      minOpenSolverFeeCap: "0.0005",
      minCloseSolverFeeCap: "0.0003",
    });
    expect(getContractSymbols).toHaveBeenCalledTimes(1);
  });

  it("resolves zero caps for a solver kind that publishes none (rasa)", async () => {
    getContractSymbolsContractSymbolsGet.mockResolvedValue({ data: { symbols: [RASA_MARKET] } });

    const result = await resolveMarket(multiSolverConfig, {
      chainId: SymmioSupportedChainId.BASE,
      solverId: "rasa",
      marketId: 1,
      includeSolverFeeCaps: true,
    });

    expect(result).toEqual({
      name: "ETHUSDT",
      pricePrecision: 7,
      quantityPrecision: 8,
      minOpenSolverFeeCap: "0",
      minCloseSolverFeeCap: "0",
    });
  });
});
