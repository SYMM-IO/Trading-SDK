import { describe, expect, it } from "vitest";
import type { ApiNotionalCapBySymbolResponse } from "../types/generated/enigma-solver";
import { toMarketNotionalCap } from "./to-market-notional-cap";

describe("toMarketNotionalCap", () => {
  it("maps every field and coerces numeric strings to numbers", () => {
    /** The solver serves several numeric fields as decimal strings; the mapper coerces them. */
    const raw = {
      symbol_id: 132,
      symbol: "DOGEUSDT",
      total_cap: 0,
      used: "500",
      available_to_long: 1000,
      available_to_short: "800",
      open_interest: 1200,
      price: "0.12",
      token_balance: 50000,
      usdc_balance: "6000",
    } as unknown as ApiNotionalCapBySymbolResponse;

    expect(toMarketNotionalCap(raw)).toEqual({
      symbolId: 132,
      symbol: "DOGEUSDT",
      totalCap: 0,
      used: 500,
      availableToLong: 1000,
      availableToShort: 800,
      openInterest: 1200,
      price: 0.12,
      tokenBalance: 50000,
      usdcBalance: 6000,
      error: null,
    });
  });

  it("defaults missing numeric fields to 0 and a missing symbol to an empty string", () => {
    expect(toMarketNotionalCap({})).toEqual({
      symbolId: 0,
      symbol: "",
      totalCap: 0,
      used: 0,
      availableToLong: 0,
      availableToShort: 0,
      openInterest: 0,
      price: 0,
      tokenBalance: 0,
      usdcBalance: 0,
      error: null,
    });
  });

  it("forwards a non-empty solver error string verbatim", () => {
    expect(toMarketNotionalCap({ error: "market paused" }).error).toBe("market paused");
  });

  it("normalizes an empty error string to null", () => {
    expect(toMarketNotionalCap({ error: "" }).error).toBeNull();
  });
});
