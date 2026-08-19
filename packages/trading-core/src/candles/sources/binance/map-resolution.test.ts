import { describe, expect, it } from "vitest";
import { getBinanceSupportedResolutions, toBinanceInterval } from "./map-resolution";

describe("toBinanceInterval", () => {
  it("maps SDK resolutions onto Binance interval strings", () => {
    expect(toBinanceInterval("usd-m-futures", "1m")).toBe("1m");
    expect(toBinanceInterval("usd-m-futures", "1h")).toBe("1h");
    expect(toBinanceInterval("usd-m-futures", "4h")).toBe("4h");
    expect(toBinanceInterval("usd-m-futures", "1d")).toBe("1d");
    expect(toBinanceInterval("usd-m-futures", "1M")).toBe("1M");
  });

  it("reports no interval for sub-minute resolutions on USD-M futures", () => {
    expect(toBinanceInterval("usd-m-futures", "1s")).toBeUndefined();
    expect(toBinanceInterval("usd-m-futures", "10s")).toBeUndefined();
  });

  it("serves 1s on spot, which does list second klines", () => {
    expect(toBinanceInterval("spot", "1s")).toBe("1s");
  });

  it("reports no interval for 10s on either market — no venue has that bucket", () => {
    expect(toBinanceInterval("spot", "10s")).toBeUndefined();
  });
});

describe("getBinanceSupportedResolutions", () => {
  it("excludes second resolutions on USD-M futures", () => {
    const resolutions = getBinanceSupportedResolutions("usd-m-futures");
    expect(resolutions).not.toContain("1s");
    expect(resolutions).not.toContain("10s");
    expect(resolutions).toContain("1m");
    expect(resolutions).toContain("1M");
  });

  it("includes 1s on spot", () => {
    expect(getBinanceSupportedResolutions("spot")).toContain("1s");
  });

  it("only lists resolutions that actually map to an interval", () => {
    for (const market of ["usd-m-futures", "spot"] as const) {
      for (const resolution of getBinanceSupportedResolutions(market)) {
        expect(toBinanceInterval(market, resolution)).toBeDefined();
      }
    }
  });
});
