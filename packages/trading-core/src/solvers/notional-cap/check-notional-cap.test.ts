import { describe, expect, it } from "vitest";
import { PositionType } from "../../symmio-contracts/symmio/types";
import { checkNotionalCap } from "./check-notional-cap";
import type { EnigmaNotionalCap, RasaNotionalCap } from "./types";

function makeCap(overrides: Partial<EnigmaNotionalCap> = {}): EnigmaNotionalCap {
  return {
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
    ...overrides,
  };
}

describe("checkNotionalCap", () => {
  it("accepts a long trade that fits within availableToLong", () => {
    expect(checkNotionalCap({ positionType: PositionType.LONG, notional: "900", cap: makeCap() })).toEqual({
      ok: true,
    });
  });

  it("accepts a trade that fits within a Rasa cap's market-wide remaining capacity", () => {
    const rasaCap: RasaNotionalCap = { kind: "rasa", totalCap: 1000, used: 200 };
    expect(checkNotionalCap({ positionType: PositionType.LONG, notional: "800", cap: rasaCap })).toEqual({ ok: true });
  });

  it("rejects a trade exceeding a Rasa cap's remaining capacity (totalCap − used), either side", () => {
    const rasaCap: RasaNotionalCap = { kind: "rasa", totalCap: 1000, used: 200 };
    for (const positionType of [PositionType.LONG, PositionType.SHORT]) {
      expect(checkNotionalCap({ positionType, notional: "801", cap: rasaCap })).toMatchObject({
        ok: false,
        kind: "CAP_REACHED",
        available: 800,
      });
    }
  });

  it("rejects a long trade whose notional exceeds availableToLong", () => {
    expect(checkNotionalCap({ positionType: PositionType.LONG, notional: "1500", cap: makeCap() })).toEqual({
      ok: false,
      kind: "CAP_REACHED",
      side: PositionType.LONG,
      available: 1000,
      requestedNotional: "1500",
    });
  });

  it("checks the short side against availableToShort", () => {
    expect(checkNotionalCap({ positionType: PositionType.SHORT, notional: "850", cap: makeCap() })).toEqual({
      ok: false,
      kind: "CAP_REACHED",
      side: PositionType.SHORT,
      available: 800,
      requestedNotional: "850",
    });
  });

  it("treats an equal notional as fitting (strict greater-than rejects)", () => {
    expect(checkNotionalCap({ positionType: PositionType.LONG, notional: "1000", cap: makeCap() })).toEqual({
      ok: true,
    });
  });

  it("is a no-op when the solver reported an error for the market", () => {
    const cap = makeCap({ error: "no cap data", availableToLong: 0 });
    expect(checkNotionalCap({ positionType: PositionType.LONG, notional: "1500", cap })).toEqual({ ok: true });
  });

  it("is a no-op when the available value is non-finite", () => {
    const cap = makeCap({ availableToLong: Number.POSITIVE_INFINITY });
    expect(checkNotionalCap({ positionType: PositionType.LONG, notional: "1500", cap })).toEqual({ ok: true });
  });

  it("is a no-op for a zero, negative, or NaN requested notional", () => {
    const cap = makeCap();
    expect(checkNotionalCap({ positionType: PositionType.LONG, notional: 0, cap })).toEqual({ ok: true });
    expect(checkNotionalCap({ positionType: PositionType.LONG, notional: "-50", cap })).toEqual({ ok: true });
    expect(checkNotionalCap({ positionType: PositionType.LONG, notional: Number.NaN, cap })).toEqual({ ok: true });
  });

  it("normalizes the requested notional to a decimal string in the failure result", () => {
    const result = checkNotionalCap({ positionType: PositionType.LONG, notional: 1500, cap: makeCap() });
    expect(result).toMatchObject({ ok: false, requestedNotional: "1500" });
  });
});
