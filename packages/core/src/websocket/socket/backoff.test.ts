import { describe, expect, it } from "vitest";
import { computeBackoffDelay } from "./backoff";

const BASE = { baseDelayMs: 500, maxDelayMs: 10_000, jitter: false };

describe("computeBackoffDelay", () => {
  it("grows exponentially from the base delay", () => {
    expect(computeBackoffDelay(0, BASE)).toBe(500);
    expect(computeBackoffDelay(1, BASE)).toBe(1_000);
    expect(computeBackoffDelay(2, BASE)).toBe(2_000);
    expect(computeBackoffDelay(3, BASE)).toBe(4_000);
  });

  it("caps at maxDelayMs", () => {
    expect(computeBackoffDelay(10, BASE)).toBe(10_000);
  });

  it("scales within [0.5, 1] of the exponential when jitter is on", () => {
    const options = { ...BASE, jitter: true };
    expect(computeBackoffDelay(2, options, () => 0)).toBe(1_000); // 2000 * 0.5
    expect(computeBackoffDelay(2, options, () => 1)).toBe(2_000); // 2000 * 1.0
  });
});
