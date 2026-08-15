import { describe, expect, it } from "vitest";
import { SymmError } from "../../../shared/errors/symm-error";
import { parseBinanceKline, parseBinanceKlineEvent, type RawBinanceKline } from "./parse-kline";

const KLINE: RawBinanceKline = [
  1_700_000_000_000,
  "42000.1",
  "42100.0",
  "41950.5",
  "42050.2",
  "12.5",
  1_700_000_059_999,
  "525000.0",
  380,
  "6.1",
  "256000.0",
  "0",
];

describe("parseBinanceKline", () => {
  it("maps the positional tuple onto a normalized candle", () => {
    expect(parseBinanceKline(KLINE)).toEqual({
      time: 1_700_000_000_000,
      open: 42000.1,
      high: 42100,
      low: 41950.5,
      close: 42050.2,
      volume: 12.5,
    });
  });

  it("keeps the open time in milliseconds", () => {
    expect(parseBinanceKline(KLINE).time).toBe(1_700_000_000_000);
  });

  it("throws on a tuple that is too short to be a kline", () => {
    expect(() => parseBinanceKline([1, "2", "3"] as unknown as RawBinanceKline)).toThrow(SymmError);
  });

  it("throws rather than emitting NaN prices", () => {
    const malformed = [1_700_000_000_000, "not-a-number", "1", "1", "1", "1"] as unknown as RawBinanceKline;
    expect(() => parseBinanceKline(malformed)).toThrow(/non-numeric/);
  });
});

describe("parseBinanceKlineEvent", () => {
  it("maps a websocket kline payload onto a normalized candle", () => {
    const candle = parseBinanceKlineEvent({
      t: 1_700_000_060_000,
      i: "1m",
      o: "42050.2",
      h: "42080.0",
      l: "42040.0",
      c: "42075.5",
      v: "3.25",
      x: false,
    });

    expect(candle).toEqual({
      time: 1_700_000_060_000,
      open: 42050.2,
      high: 42080,
      low: 42040,
      close: 42075.5,
      volume: 3.25,
    });
  });

  it("throws on non-numeric prices", () => {
    expect(() => parseBinanceKlineEvent({ t: 1, i: "1m", o: "x", h: "1", l: "1", c: "1", v: "1", x: true })).toThrow(
      SymmError,
    );
  });
});
