import { describe, expect, it } from "vitest";
import { parseEnigmaOhlcv } from "./parse-enigma-ohlcv";

const BAR = { timestamp: 1_700_000_040, open: 2, high: 4, low: 1, close: 3, volume: 12.75 };

describe("parseEnigmaOhlcv", () => {
  it("converts UTC start seconds to milliseconds and preserves prices and USD volume", () => {
    expect(parseEnigmaOhlcv({ result: [BAR] })).toEqual([
      { time: 1_700_000_040_000, open: 2, high: 4, low: 1, close: 3, volume: 12.75 },
    ]);
  });

  it("keeps gaps and zero volume without synthesizing bars", () => {
    const candles = parseEnigmaOhlcv({ result: [BAR, { ...BAR, timestamp: BAR.timestamp + 3600, volume: 0 }] });
    expect(candles).toHaveLength(2);
    expect(candles[1]?.time).toBe(1_700_003_640_000);
    expect(candles[1]?.volume).toBe(0);
  });

  it("does not drop flat candles or volume-bearing candles returned by the service", () => {
    const flat = { ...BAR, open: 3, high: 3, low: 3, close: 3, volume: 0 };
    const candles = parseEnigmaOhlcv({
      result: [flat, { ...flat, timestamp: flat.timestamp + 60, volume: 12 }],
    });
    expect(candles).toHaveLength(2);
    expect(candles.map((candle) => candle.volume)).toEqual([0, 12]);
  });

  it("accepts an empty result", () => {
    expect(parseEnigmaOhlcv({ result: [] })).toEqual([]);
  });

  it.each([undefined, null, [], {}, { result: null }, { result: {} }, { result: [null] }, { result: [{}] }])(
    "rejects malformed response %j",
    (data) => {
      expect(() => parseEnigmaOhlcv(data)).toThrow(expect.objectContaining({ code: "INVALID_ENIGMA_OHLCV_RESPONSE" }));
    },
  );

  it.each([
    { timestamp: "1700000040" },
    { timestamp: 1.5 },
    { timestamp: Number.MAX_SAFE_INTEGER },
    { open: "2" },
    { high: Number.POSITIVE_INFINITY },
    { low: Number.NaN },
    { close: null },
    { volume: undefined },
    { volume: -1 },
  ])("rejects invalid candle values %j", (invalid) => {
    expect(() => parseEnigmaOhlcv({ result: [{ ...BAR, ...invalid }] })).toThrow(
      expect.objectContaining({ code: "INVALID_ENIGMA_OHLCV_RESPONSE" }),
    );
  });

  it.each([BAR.timestamp, BAR.timestamp - 60])("rejects duplicate or descending start %s", (timestamp) => {
    expect(() => parseEnigmaOhlcv({ result: [BAR, { ...BAR, timestamp }] })).toThrow(
      expect.objectContaining({ code: "INVALID_ENIGMA_OHLCV_RESPONSE" }),
    );
  });
});
