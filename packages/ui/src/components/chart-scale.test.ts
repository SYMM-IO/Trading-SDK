import { describe, expect, it } from "vitest";
import { linearScale, nearestIndex, niceTicks, pickTickIndices, roundedTopRect, stackSegments } from "./chart-scale";

describe("linearScale", () => {
  it("maps the domain onto the range, flipped when the range runs downward", () => {
    const y = linearScale([0, 100], [200, 0]);
    expect(y(0)).toBe(200);
    expect(y(50)).toBe(100);
    expect(y(100)).toBe(0);
  });

  it("does not divide by zero on a flat domain", () => {
    const x = linearScale([5, 5], [0, 300]);
    expect(x(5)).toBe(0);
  });
});

describe("niceTicks", () => {
  it("rounds to 1/2/5 steps and always starts at zero", () => {
    expect(niceTicks(337.4, 4)).toEqual([0, 100, 200, 300, 400]);
    expect(niceTicks(9, 4)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(0.037, 3)).toEqual([0, 0.01, 0.02, 0.03, 0.04]);
  });

  it("still draws an axis for an all-zero series", () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(Number.NaN)).toEqual([0, 1]);
  });
});

describe("pickTickIndices", () => {
  it("always keeps the first and last position", () => {
    expect(pickTickIndices(30, 4)).toEqual([0, 10, 19, 29]);
    expect(pickTickIndices(2, 10)).toEqual([0, 1]);
    expect(pickTickIndices(1, 10)).toEqual([0]);
  });

  it("never labels more positions than exist", () => {
    expect(pickTickIndices(3, 8)).toEqual([0, 1, 2]);
  });
});

describe("nearestIndex", () => {
  it("snaps to the closest position on either side", () => {
    const xs = [0, 10, 20, 30];
    expect(nearestIndex(xs, 4)).toBe(0);
    expect(nearestIndex(xs, 6)).toBe(1);
    expect(nearestIndex(xs, 25)).toBe(2);
    expect(nearestIndex(xs, 99)).toBe(3);
    expect(nearestIndex([], 5)).toBe(-1);
  });
});

describe("stackSegments", () => {
  it("accumulates positive values and gives empty segments no height", () => {
    expect(stackSegments([2, 0, 3])).toEqual([
      [0, 2],
      [2, 2],
      [2, 5],
    ]);
  });
});

describe("roundedTopRect", () => {
  it("rounds only the top corners and clamps the radius to the bar", () => {
    expect(roundedTopRect(0, 0, 10, 20, 4)).toBe("M0,20V4Q0,0 4,0H6Q10,0 10,4V20Z");
    expect(roundedTopRect(0, 0, 4, 20, 4)).toBe("M0,20V2Q0,0 2,0H2Q4,0 4,2V20Z");
    expect(roundedTopRect(0, 0, 10, 0, 4)).toBe("");
  });
});
