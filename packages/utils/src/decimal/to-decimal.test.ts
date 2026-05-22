import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { toDecimal } from "./to-decimal";

describe("toDecimal", () => {
  it("returns zero for null", () => {
    expect(toDecimal(null).toString()).toBe("0");
  });

  it("returns zero for undefined", () => {
    expect(toDecimal(undefined).toString()).toBe("0");
  });

  it("returns zero for empty string", () => {
    expect(toDecimal("").toString()).toBe("0");
  });

  it("wraps numbers as Decimal", () => {
    expect(toDecimal(1.5).toString()).toBe("1.5");
  });

  it("wraps strings as Decimal", () => {
    expect(toDecimal("1.234").toFixed()).toBe("1.234");
  });

  it("preserves Decimal instances semantically", () => {
    const d = new Decimal("0.1");
    expect(toDecimal(d).toString()).toBe("0.1");
  });
});
