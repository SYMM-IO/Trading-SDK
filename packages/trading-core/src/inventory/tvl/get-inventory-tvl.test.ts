import { describe, expect, it } from "vitest";
import { toInventoryTvl } from "./get-inventory-tvl";

describe("toInventoryTvl", () => {
  it("parses the live 18-decimal TVL string without losing precision", () => {
    expect(toInventoryTvl("630232531461381896637475")).toBe(630232531461381896637475n);
  });

  it("defaults to zero rather than throwing on a missing or unparseable value", () => {
    expect(toInventoryTvl(null)).toBe(0n);
    expect(toInventoryTvl(undefined)).toBe(0n);
    expect(toInventoryTvl("")).toBe(0n);
    expect(toInventoryTvl("not-a-number")).toBe(0n);
  });

  it("truncates a fractional tail toward zero instead of throwing", () => {
    expect(toInventoryTvl("123.9")).toBe(123n);
    expect(toInventoryTvl("-123.9")).toBe(-123n);
  });
});
