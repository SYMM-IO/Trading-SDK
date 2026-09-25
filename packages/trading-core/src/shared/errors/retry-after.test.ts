import { describe, expect, it } from "vitest";
import { parseRetryAfterMs } from "./retry-after";

const NOW = Date.parse("2026-09-17T12:00:00Z");

describe("parseRetryAfterMs", () => {
  it("converts delay-seconds to milliseconds", () => {
    expect(parseRetryAfterMs("120", NOW)).toBe(120_000);
    expect(parseRetryAfterMs(" 0 ", NOW)).toBe(0);
  });

  it("measures an HTTP-date against the reference time", () => {
    expect(parseRetryAfterMs("Thu, 17 Sep 2026 12:00:30 GMT", NOW)).toBe(30_000);
  });

  it("clamps an HTTP-date in the past to zero", () => {
    expect(parseRetryAfterMs("Thu, 17 Sep 2026 11:59:00 GMT", NOW)).toBe(0);
  });

  it("defaults the reference time to now", () => {
    const inOneMinute = new Date(Date.now() + 60_000).toUTCString();

    const ms = parseRetryAfterMs(inOneMinute);

    expect(ms).not.toBeNull();
    expect(ms).toBeGreaterThan(55_000);
    expect(ms).toBeLessThanOrEqual(60_000);
  });

  it.each([
    { label: "an absent header", value: undefined },
    { label: "an empty value", value: "   " },
    { label: "a negative number", value: "-5" },
    { label: "a fractional number", value: "1.5" },
    { label: "an unparseable date", value: "soon, maybe" },
    { label: "a delay beyond the safe-integer range", value: "99999999999999999999" },
  ])("returns null for $label", ({ value }) => {
    expect(parseRetryAfterMs(value, NOW)).toBeNull();
  });
});
