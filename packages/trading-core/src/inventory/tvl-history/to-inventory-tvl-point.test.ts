import { describe, expect, it } from "vitest";
import { toInventoryTvlPoint } from "./to-inventory-tvl-point";

describe("toInventoryTvlPoint", () => {
  it("keeps the timestamp as-is and parses the 18-decimal tvl string without losing precision", () => {
    expect(toInventoryTvlPoint({ timestamp: 1_752_364_800, tvl: "177780000000000000000" })).toEqual({
      timestamp: 1_752_364_800,
      tvl: 177780000000000000000n,
    });
  });

  it("collapses an unparseable tvl to zero so one bad snapshot cannot break a chart", () => {
    expect(toInventoryTvlPoint({ timestamp: 1, tvl: "" }).tvl).toBe(0n);
    expect(toInventoryTvlPoint({ timestamp: 1, tvl: "not-a-number" }).tvl).toBe(0n);
  });
});
