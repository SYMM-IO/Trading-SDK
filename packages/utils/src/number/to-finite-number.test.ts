import { describe, expect, it } from "vitest";
import { toFiniteNumber } from "./to-finite-number";

describe("toFiniteNumber", () => {
  it("returns finite numbers unchanged", () => {
    expect(toFiniteNumber(1.5)).toBe(1.5);
    expect(toFiniteNumber(0)).toBe(0);
    expect(toFiniteNumber(-42)).toBe(-42);
  });

  it("parses numeric strings", () => {
    expect(toFiniteNumber("112258.59")).toBe(112258.59);
    expect(toFiniteNumber("-0.001")).toBe(-0.001);
    expect(toFiniteNumber("  7 ")).toBe(7);
  });

  it("defaults to 0 for nullish input", () => {
    expect(toFiniteNumber(undefined)).toBe(0);
    expect(toFiniteNumber(null)).toBe(0);
    expect(toFiniteNumber()).toBe(0);
  });

  it("defaults to 0 for the empty string", () => {
    expect(toFiniteNumber("")).toBe(0);
  });

  it("defaults to 0 for non-numeric strings", () => {
    expect(toFiniteNumber("oops")).toBe(0);
    expect(toFiniteNumber("12abc")).toBe(0);
  });

  it("defaults to 0 for non-finite numbers", () => {
    expect(toFiniteNumber(NaN)).toBe(0);
    expect(toFiniteNumber(Infinity)).toBe(0);
    expect(toFiniteNumber(-Infinity)).toBe(0);
  });
});
