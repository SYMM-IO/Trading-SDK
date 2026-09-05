import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockConfig } from "../../shared/test/mock-config";
import type { EnigmaNotionalCap, RasaNotionalCap } from "./types";

const getNotionalCapBySymbolId = vi.hoisted(() => vi.fn());

vi.mock("./get-notional-cap-by-symbol-id", () => ({
  getNotionalCapBySymbolId,
}));

import { getOpenInterestBySymbolId } from "./get-open-interest-by-symbol-id";

const SAMPLE_CAP: EnigmaNotionalCap = {
  kind: "enigma",
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
};

const RASA_CAP: RasaNotionalCap = { kind: "rasa", totalCap: 4000, used: 500 };

describe("getOpenInterestBySymbolId", () => {
  beforeEach(() => {
    getNotionalCapBySymbolId.mockReset();
  });

  it("derives the effective totalCap as availableToLong + availableToShort + openInterest", async () => {
    getNotionalCapBySymbolId.mockResolvedValue(SAMPLE_CAP);
    const { config } = mockConfig();

    const result = await getOpenInterestBySymbolId(config, { symbolId: 132 });

    expect(result).toEqual({
      symbolId: 132,
      symbol: "DOGEUSDT",
      openInterest: 1200,
      totalCap: 3000,
      error: null,
    });
  });

  it("forwards the config and parameters to getNotionalCapBySymbolId", async () => {
    getNotionalCapBySymbolId.mockResolvedValue(SAMPLE_CAP);
    const { config } = mockConfig();

    await getOpenInterestBySymbolId(config, { chainId: SAMPLE_CAP.symbolId, symbolId: 132 });

    expect(getNotionalCapBySymbolId).toHaveBeenCalledWith(config, { chainId: SAMPLE_CAP.symbolId, symbolId: 132 });
  });

  it("passes through the solver-reported error string", async () => {
    getNotionalCapBySymbolId.mockResolvedValue({ ...SAMPLE_CAP, error: "market paused" });
    const { config } = mockConfig();

    expect((await getOpenInterestBySymbolId(config, { symbolId: 132 })).error).toBe("market paused");
  });

  it("maps a Rasa cap: openInterest = used, totalCap = totalCap, no per-side/error", async () => {
    getNotionalCapBySymbolId.mockResolvedValue(RASA_CAP);
    const { config } = mockConfig();

    const result = await getOpenInterestBySymbolId(config, { symbolId: 7 });

    expect(result).toEqual({ symbolId: 7, symbol: "", openInterest: 500, totalCap: 4000, error: null });
  });
});
