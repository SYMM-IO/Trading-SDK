import { describe, expect, it } from "vitest";
import { parsePriceFrame } from "./parse-price-frame";

describe("parsePriceFrame", () => {
  it("parses an array of ticks with numeric markPrice (wire shape)", () => {
    const ticks = parsePriceFrame([
      { name: "BTCUSDT", markPrice: 65000.123, time: 1782137163610, address: "0xabc" },
      { name: "ETHUSDT", markPrice: 3200.5 },
    ]);
    expect(ticks).toEqual([
      { name: "BTCUSDT", markPrice: "65000.123", time: 1782137163610, address: "0xabc" },
      { name: "ETHUSDT", markPrice: "3200.5" },
    ]);
  });

  it("accepts string markPrice for forward-compat", () => {
    expect(parsePriceFrame([{ name: "X", markPrice: "1.5" }])).toEqual([{ name: "X", markPrice: "1.5" }]);
  });

  it("parses a JSON string", () => {
    const ticks = parsePriceFrame(JSON.stringify([{ name: "BTCUSDT", markPrice: 100 }]));
    expect(ticks).toEqual([{ name: "BTCUSDT", markPrice: "100" }]);
  });

  it("returns null for non-array payloads", () => {
    expect(parsePriceFrame({ foo: "bar" })).toBeNull();
    expect(parsePriceFrame("not-json")).toBeNull();
    expect(parsePriceFrame(null)).toBeNull();
  });

  it("skips entries missing required fields", () => {
    const ticks = parsePriceFrame([
      { name: "OK", markPrice: 1 },
      { name: "NoPrice" },
      { markPrice: 2 },
      { name: 1, markPrice: 3 },
      { name: "NaN", markPrice: Number.NaN },
      null,
    ]);
    expect(ticks).toEqual([{ name: "OK", markPrice: "1" }]);
  });
});
