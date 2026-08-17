import { describe, expect, it } from "vitest";
import { SymmError } from "../../../shared/errors/symm-error";
import { parseBinanceDepthLevel, parseBinanceDepthLevels } from "./parse-depth";

describe("parseBinanceDepthLevel", () => {
  it("parses a decimal-string pair into numbers", () => {
    expect(parseBinanceDepthLevel(["63018.10", "31.790"])).toEqual({ price: 63018.1, size: 31.79 });
  });

  it("preserves a zero quantity, since that is the removal instruction", () => {
    /** Filtering zeros here would leave a removed level resting on the book forever. */
    expect(parseBinanceDepthLevel(["63018.10", "0"])).toEqual({ price: 63018.1, size: 0 });
    expect(parseBinanceDepthLevel(["63018.10", "0.00000000"])).toEqual({ price: 63018.1, size: 0 });
  });

  it("handles the full-precision strings spot returns", () => {
    expect(parseBinanceDepthLevel(["63044.99000000", "6.00582000"])).toEqual({ price: 63044.99, size: 6.00582 });
  });

  it("throws on a non-numeric price", () => {
    expect(() => parseBinanceDepthLevel(["abc", "1"])).toThrow(SymmError);
    expect(() => parseBinanceDepthLevel(["abc", "1"])).toThrow(/non-numeric `price`/);
  });

  it("throws on a non-numeric quantity", () => {
    expect(() => parseBinanceDepthLevel(["1", "abc"])).toThrow(/non-numeric `quantity`/);
  });

  it("carries the INVALID_BINANCE_DEPTH code", () => {
    try {
      parseBinanceDepthLevel(["abc", "1"]);
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as SymmError).code).toBe("INVALID_BINANCE_DEPTH");
      expect((err as SymmError).kind).toBe("api");
    }
  });

  it("throws on a pair that is too short", () => {
    expect(() => parseBinanceDepthLevel(["1"] as unknown as [string, string])).toThrow(/\[price, quantity\] pair/);
  });

  it("throws when the level is not an array at all", () => {
    expect(() => parseBinanceDepthLevel({ price: 1 } as unknown as [string, string])).toThrow(SymmError);
  });
});

describe("parseBinanceDepthLevels", () => {
  it("preserves the venue's ordering", () => {
    const levels = parseBinanceDepthLevels([
      ["100", "1"],
      ["99", "2"],
      ["98", "3"],
    ]);

    expect(levels.map((level) => level.price)).toEqual([100, 99, 98]);
  });

  it("treats an absent side as empty, which is how a one-sided update arrives", () => {
    expect(parseBinanceDepthLevels(undefined)).toEqual([]);
  });

  it("returns an empty array for an empty side", () => {
    expect(parseBinanceDepthLevels([])).toEqual([]);
  });

  it("throws when the side is not an array", () => {
    expect(() => parseBinanceDepthLevels({} as unknown as [string, string][])).toThrow(/not an array/);
  });

  it("propagates a malformed level rather than skipping it", () => {
    /** A silently dropped level would desynchronize the book with no signal. */
    expect(() =>
      parseBinanceDepthLevels([
        ["100", "1"],
        ["bad", "1"],
      ]),
    ).toThrow(SymmError);
  });
});
