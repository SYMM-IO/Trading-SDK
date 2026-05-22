import { describe, expect, it } from "vitest";
import { minifyHash } from "./minify-hash";

const HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

describe("minifyHash", () => {
  it("shortens to 6-prefix + 4-suffix by default", () => {
    expect(minifyHash(HASH)).toBe("0x1234...cdef");
  });

  it("returns the em-dash placeholder for null", () => {
    expect(minifyHash(null)).toBe("—");
  });

  it("returns the em-dash placeholder for undefined", () => {
    expect(minifyHash(undefined)).toBe("—");
  });

  it("accepts custom start/end lengths and ellipsis", () => {
    expect(minifyHash(HASH, { start: 4, end: 6, ellipsis: "…" })).toBe("0x12…abcdef");
  });

  it("respects a custom placeholder", () => {
    expect(minifyHash(null, { placeholder: "n/a" })).toBe("n/a");
  });
});
