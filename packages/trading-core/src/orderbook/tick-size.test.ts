import { describe, expect, it } from "vitest";
import { SymmError } from "../shared/errors/symm-error";
import { countTickDecimals, roundToTick, suggestOrderbookTickSizes } from "./tick-size";

describe("countTickDecimals", () => {
  it("counts decimals of a plain decimal tick", () => {
    expect(countTickDecimals(1)).toBe(0);
    expect(countTickDecimals(0.1)).toBe(1);
    expect(countTickDecimals(0.01)).toBe(2);
    expect(countTickDecimals(0.00001)).toBe(5);
  });

  it("counts decimals of a tick that stringifies in exponential form", () => {
    /** `1e-7` and smaller stringify with an exponent; a naive split reports 0. */
    expect((1e-7).toString()).toBe("1e-7");
    expect(countTickDecimals(1e-7)).toBe(7);
    expect(countTickDecimals(1e-9)).toBe(9);
  });

  it("counts decimals when the exponential form also has a mantissa fraction", () => {
    expect((2.5e-7).toString()).toBe("2.5e-7");
    expect(countTickDecimals(2.5e-7)).toBe(8);
  });

  it("returns 0 for non-positive or non-finite ticks", () => {
    expect(countTickDecimals(0)).toBe(0);
    expect(countTickDecimals(-1)).toBe(0);
    expect(countTickDecimals(Number.NaN)).toBe(0);
  });
});

describe("roundToTick", () => {
  it("rounds down and up onto the grid", () => {
    expect(roundToTick(63018.17, 0.1, "down")).toBe(63018.1);
    expect(roundToTick(63018.17, 0.1, "up")).toBe(63018.2);
  });

  it("leaves a price that is already on the grid untouched in both directions", () => {
    /**
     * The float trap this guards. Dividing by a decimal tick lands just under
     * the true integer, so flooring the raw quotient moves an on-grid price a
     * whole tick down — 8.2 would be grouped as 8.1.
     */
    expect(8.2 / 0.1).toBe(81.99999999999999);
    expect(roundToTick(8.2, 0.1, "down")).toBe(8.2);
    expect(roundToTick(8.2, 0.1, "up")).toBe(8.2);

    /** And the mirror case, where the quotient lands just above. */
    expect(0.07 / 0.01).toBe(7.000000000000001);
    expect(roundToTick(0.07, 0.01, "up")).toBe(0.07);
    expect(roundToTick(0.07, 0.01, "down")).toBe(0.07);
  });

  it("does not lose a tick on prices whose quotient is inexact", () => {
    for (const [price, tick] of [
      [0.3, 0.1],
      [8.2, 0.1],
      [4.35, 0.01],
      [1.15, 0.01],
    ] as const) {
      expect(Number.isInteger(price / tick)).toBe(false);
      expect(roundToTick(price, tick, "down")).toBe(price);
      expect(roundToTick(price, tick, "up")).toBe(price);
    }
  });

  it("does not leave binary-float dust in the result", () => {
    expect(roundToTick(0.30000000000000004, 0.1, "down")).toBe(0.3);
    expect(roundToTick(1.005, 0.01, "up")).toBe(1.01);
  });

  it("handles integer ticks", () => {
    expect(roundToTick(63018.9, 1, "down")).toBe(63018);
    expect(roundToTick(63018.1, 1, "up")).toBe(63019);
    expect(roundToTick(63050, 50, "down")).toBe(63050);
    expect(roundToTick(63051, 50, "up")).toBe(63100);
  });

  it("handles very small ticks without losing precision", () => {
    expect(roundToTick(0.000012345, 1e-9, "down")).toBeCloseTo(0.000012345, 12);
    expect(roundToTick(0.0000123456, 1e-7, "up")).toBe(0.0000124);
  });

  it("throws on a non-positive tick", () => {
    expect(() => roundToTick(1, 0, "down")).toThrow(SymmError);
    expect(() => roundToTick(1, -0.1, "down")).toThrow(/positive finite/);
  });
});

describe("suggestOrderbookTickSizes", () => {
  it("starts at the venue tick and steps 1/2/5/10", () => {
    expect(suggestOrderbookTickSizes(0.1, 63_000)).toEqual([0.1, 0.2, 0.5, 1, 2, 5, 10, 20]);
  });

  it("stops before groupings that would collapse the ladder", () => {
    /** Half a percent of 1.25 is 0.00625, so 0.005 is the last usable step. */
    expect(suggestOrderbookTickSizes(0.0001, 1.25)).toEqual([0.0001, 0.0002, 0.0005, 0.001, 0.002, 0.005]);
  });

  it("always offers the venue tick even when it already exceeds the ceiling", () => {
    expect(suggestOrderbookTickSizes(1, 10)).toEqual([1]);
  });

  it("honours maxSteps", () => {
    expect(suggestOrderbookTickSizes(0.1, 63_000, { maxSteps: 3 })).toEqual([0.1, 0.2, 0.5]);
  });

  it("honours a custom band", () => {
    expect(suggestOrderbookTickSizes(0.1, 63_000, { maxFractionOfPrice: 0.00002 })).toEqual([0.1, 0.2, 0.5, 1]);
  });

  it("falls back to an unbounded ladder when there is no usable reference price", () => {
    expect(suggestOrderbookTickSizes(0.1, 0)).toHaveLength(8);
  });

  it("keeps every entry free of float dust", () => {
    for (const tick of suggestOrderbookTickSizes(0.001, 5)) {
      expect(tick.toString()).not.toMatch(/0000000|9999999/);
    }
  });

  it("returns nothing for an invalid tick", () => {
    expect(suggestOrderbookTickSizes(0, 100)).toEqual([]);
    expect(suggestOrderbookTickSizes(Number.NaN, 100)).toEqual([]);
  });
});
