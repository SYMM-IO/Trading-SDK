import type { PublicClient } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createConfig } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";

const getContractSymbols = vi.hoisted(() => vi.fn());

vi.mock("../../types/generated/enigma-solver", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../types/generated/enigma-solver")>();
  return { ...actual, getContractSymbols };
});

import { resolveMarket } from "./resolve-market";

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

const MARKET = { symbol_id: 1, name: "BTCUSDT", symbol: "BTC", price_precision: 2, quantity_precision: 3 };

describe("resolveMarket", () => {
  beforeEach(() => {
    getContractSymbols.mockReset();
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
});
