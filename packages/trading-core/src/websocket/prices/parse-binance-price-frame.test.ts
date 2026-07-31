import { describe, expect, it } from "vitest";
import { parseBinancePriceFrame } from "./parse-binance-price-frame";
import { parsePriceFrame } from "./parse-price-frame";

/** Captured verbatim from the live `!markPrice@arr@1s` stream. */
const LIVE_ENTRY = {
  e: "markPriceUpdate",
  E: 1785422506002,
  s: "BTCUSDT",
  p: "64790.20000000",
  ap: "64790.20000000",
  P: "64763.55420338",
  i: "64818.28978261",
  r: "0.00010000",
  T: 1785427200000,
  st: 1,
};

describe("parseBinancePriceFrame", () => {
  it("parses a live top-level array frame", () => {
    expect(parseBinancePriceFrame(JSON.stringify([LIVE_ENTRY]))).toEqual([
      {
        provider: "binance",
        name: "BTCUSDT",
        markPrice: "64790.20000000",
        indexPrice: "64818.28978261",
        binanceLastFundingRate: "0.00010000",
        binanceNextFundingTime: 1785427200000,
        time: 1785422506002,
      },
    ]);
  });

  /** The live wire carries `ap` and `st`, which Binance's own docs omit. */
  it("tolerates undocumented extra fields", () => {
    expect(parseBinancePriceFrame([LIVE_ENTRY])?.[0]?.markPrice).toBe("64790.20000000");
  });

  it("accepts a combined-stream envelope", () => {
    expect(parseBinancePriceFrame({ stream: "!markPrice@arr@1s", data: [LIVE_ENTRY] })).toHaveLength(1);
  });

  it("accepts a bare single-symbol object", () => {
    expect(parseBinancePriceFrame(LIVE_ENTRY)?.[0]?.name).toBe("BTCUSDT");
  });

  it("returns null for malformed JSON", () => {
    expect(parseBinancePriceFrame("{not json")).toBeNull();
  });

  it("returns null for a control frame", () => {
    expect(parseBinancePriceFrame({ result: null, id: 1 })).toBeNull();
  });

  it("skips an entry missing the symbol or the price", () => {
    expect(parseBinancePriceFrame([{ ...LIVE_ENTRY, s: "" }, LIVE_ENTRY])).toHaveLength(1);
    expect(parseBinancePriceFrame([{ ...LIVE_ENTRY, p: undefined }, LIVE_ENTRY])).toHaveLength(1);
  });

  it("coerces a numeric price with String(), never arithmetic", () => {
    expect(parseBinancePriceFrame([{ ...LIVE_ENTRY, p: 64790.2 }])?.[0]?.markPrice).toBe("64790.2");
  });

  it("keeps a tick whose funding fields are missing", () => {
    const tick = parseBinancePriceFrame([{ s: "BTCUSDT", p: "1" }])?.[0];

    expect(tick).toMatchObject({ markPrice: "1", indexPrice: "", binanceNextFundingTime: 0 });
  });

  /**
   * The reason this parser exists rather than a shared one: the Enigma parser
   * requires `name` + `markPrice`, so every Binance entry falls through and it
   * yields an empty array — a feed that reports `open` and never ticks.
   */
  it("documents why parsePriceFrame cannot be reused for Binance frames", () => {
    expect(parsePriceFrame(JSON.stringify([LIVE_ENTRY]))).toEqual([]);
    expect(parseBinancePriceFrame(JSON.stringify([LIVE_ENTRY]))).toHaveLength(1);
  });
});

describe("parseBinancePriceFrame — per-frame memo", () => {
  const frame = [LIVE_ENTRY];

  /**
   * The socket pool hands the SAME payload reference to every listener, so
   * without this N watchers each re-parse a ~740-entry array once per second.
   */
  it("returns the identical array for a repeated reference", () => {
    const a = parseBinancePriceFrame(frame);
    const b = parseBinancePriceFrame(frame);

    expect(a).toBe(b);
  });

  it("re-parses a different reference with equal content", () => {
    const a = parseBinancePriceFrame([{ ...LIVE_ENTRY }]);
    const b = parseBinancePriceFrame([{ ...LIVE_ENTRY }]);

    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it("does not let a cached frame leak into the next one", () => {
    parseBinancePriceFrame([LIVE_ENTRY]);
    const next = parseBinancePriceFrame([{ ...LIVE_ENTRY, s: "ETHUSDT", p: "1" }]);

    expect(next?.[0]?.name).toBe("ETHUSDT");
  });
});
