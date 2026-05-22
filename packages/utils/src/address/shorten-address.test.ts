import { describe, expect, it } from "vitest";
import { shortenAddress } from "./shorten-address";

const FULL = "0x46493c376758da47823d7e3ae5d417ea6546eeb3";
const CHECKSUMMED = "0x46493c376758Da47823D7E3Ae5d417eA6546eEB3";

describe("shortenAddress", () => {
  it("returns a checksummed prefix and suffix joined by an ellipsis", () => {
    expect(shortenAddress(FULL)).toBe("0x4649…eEB3");
  });

  it("respects a custom char count", () => {
    expect(shortenAddress(FULL, { chars: 6 })).toBe("0x46493c…46eEB3");
  });

  it("respects a custom ellipsis", () => {
    expect(shortenAddress(FULL, { ellipsis: "..." })).toBe("0x4649...eEB3");
  });

  it("accepts already-checksummed input", () => {
    expect(shortenAddress(CHECKSUMMED)).toBe("0x4649…eEB3");
  });

  it("throws on a non-address string", () => {
    expect(() => shortenAddress("not-an-address" as `0x${string}`)).toThrow();
  });
});
