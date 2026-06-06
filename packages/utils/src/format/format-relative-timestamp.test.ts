import { describe, expect, it } from "vitest";
import { formatRelativeTimestamp } from "./format-relative-timestamp";

const NOW_SECONDS = 1_700_000_000;

describe("formatRelativeTimestamp", () => {
  it("formats future timestamps with generic wording", () => {
    expect(formatRelativeTimestamp(BigInt(NOW_SECONDS + 60), { nowSeconds: NOW_SECONDS })).toBe("in 1m");
    expect(formatRelativeTimestamp(BigInt(NOW_SECONDS + 3_900), { nowSeconds: NOW_SECONDS })).toBe("in 1h 5m");
    expect(formatRelativeTimestamp(BigInt(NOW_SECONDS + 90_000), { nowSeconds: NOW_SECONDS })).toBe("in 1d 1h");
  });

  it("formats past timestamps with generic wording", () => {
    expect(formatRelativeTimestamp(BigInt(NOW_SECONDS - 30), { nowSeconds: NOW_SECONDS })).toBe("30s ago");
    expect(formatRelativeTimestamp(BigInt(NOW_SECONDS - 3_600), { nowSeconds: NOW_SECONDS })).toBe("1h ago");
  });

  it("supports product-specific wording", () => {
    expect(
      formatRelativeTimestamp(BigInt(NOW_SECONDS + 120), {
        nowSeconds: NOW_SECONDS,
        nowLabel: "expires now",
        formatFuture: (duration) => `expires in ${duration}`,
        formatPast: (duration) => `expired ${duration} ago`,
      }),
    ).toBe("expires in 2m");

    expect(
      formatRelativeTimestamp(BigInt(NOW_SECONDS - 120), {
        nowSeconds: NOW_SECONDS,
        nowLabel: "expires now",
        formatFuture: (duration) => `expires in ${duration}`,
        formatPast: (duration) => `expired ${duration} ago`,
      }),
    ).toBe("expired 2m ago");
  });

  it("returns the now label when timestamps match", () => {
    expect(formatRelativeTimestamp(BigInt(NOW_SECONDS), { nowSeconds: NOW_SECONDS })).toBe("now");
    expect(formatRelativeTimestamp(BigInt(NOW_SECONDS), { nowSeconds: NOW_SECONDS, nowLabel: "expires now" })).toBe(
      "expires now",
    );
  });

  it("returns the unset label for zero or negative timestamps", () => {
    expect(formatRelativeTimestamp(0n, { nowSeconds: NOW_SECONDS })).toBe("Not set");
    expect(formatRelativeTimestamp(-1n, { nowSeconds: NOW_SECONDS, unsetLabel: "Unavailable" })).toBe("Unavailable");
  });

  it("guards timestamps that cannot be represented safely as a number", () => {
    expect(formatRelativeTimestamp(BigInt(Number.MAX_SAFE_INTEGER) + 1n, { nowSeconds: NOW_SECONDS })).toBe(
      "Timestamp is too large to format",
    );
  });
});
