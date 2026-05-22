import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { formatEther } from "./format-ether";
import { formatUnits } from "./format-units";

describe("formatEther", () => {
  it("converts whole wei to ether", () => {
    expect(formatEther("2000000000000000000").toString()).toBe("2");
  });

  it("converts sub-ether wei amounts", () => {
    expect(formatEther("2000000000000000").toString()).toBe("0.002");
  });

  it("matches formatUnits(value, 18)", () => {
    expect(formatEther("3140000000000000000").toString()).toBe(formatUnits("3140000000000000000", 18).toString());
  });

  it("accepts numeric input", () => {
    expect(formatEther(1_000_000_000_000_000_000).toString()).toBe("1");
  });

  it("accepts Decimal input", () => {
    expect(formatEther(new Decimal("500000000000000000")).toString()).toBe("0.5");
  });

  it("accepts bigint input", () => {
    expect(formatEther(1_000_000_000_000_000_000n).toString()).toBe("1");
  });

  it("returns 0 for undefined input", () => {
    expect(formatEther(undefined).toString()).toBe("0");
  });

  it("returns 0 for empty string", () => {
    expect(formatEther("").toString()).toBe("0");
  });

  it("handles negative values", () => {
    expect(formatEther("-1000000000000000000").toString()).toBe("-1");
  });

  it("returns the smallest fraction for 1 wei", () => {
    expect(formatEther("1").toFixed()).toBe("0.000000000000000001");
  });

  it("returns a Decimal instance", () => {
    expect(formatEther("1000000000000000000")).toBeInstanceOf(Decimal);
  });
});
