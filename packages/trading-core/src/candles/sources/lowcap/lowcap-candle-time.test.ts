import { describe, expect, it } from "vitest";
import { floorLowcapCandleTime, shiftLowcapCandleTime } from "./lowcap-candle-time";

describe("lowcap UTC calendar boundaries", () => {
  it("starts weeks on Monday across a year boundary", () => {
    expect(new Date(floorLowcapCandleTime(Date.parse("2027-01-03T23:59:59Z"), "1w")).toISOString()).toBe(
      "2026-12-28T00:00:00.000Z",
    );
  });
  it("advances leap-year months by calendar boundaries rather than 30 days", () => {
    const february = floorLowcapCandleTime(Date.parse("2024-02-29T12:00:00Z"), "1M");
    expect(new Date(february).toISOString()).toBe("2024-02-01T00:00:00.000Z");
    expect(new Date(shiftLowcapCandleTime(february, "1M", 1)).toISOString()).toBe("2024-03-01T00:00:00.000Z");
    expect(new Date(shiftLowcapCandleTime(february, "1M", -2)).toISOString()).toBe("2023-12-01T00:00:00.000Z");
  });
});
