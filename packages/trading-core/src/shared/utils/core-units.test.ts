import { maxUint256 } from "viem";
import { describe, expect, it } from "vitest";
import { collateralToCore18, core18ToCollateral } from "./core-units";

const ONE_CORE = 10n ** 18n;

describe("collateralToCore18", () => {
  it("scales a 6-decimal amount by 10^12", () => {
    expect(collateralToCore18(1_000000n, 6)).toBe(ONE_CORE);
    expect(collateralToCore18(30_000n, 6)).toBe(3n * 10n ** 16n);
    expect(collateralToCore18(1n, 6)).toBe(10n ** 12n);
  });

  it("leaves an 18-decimal amount unchanged", () => {
    expect(collateralToCore18(5n, 18)).toBe(5n);
    expect(collateralToCore18(maxUint256, 18)).toBe(maxUint256);
  });

  it("scales a 0-decimal amount by 10^18", () => {
    expect(collateralToCore18(7n, 0)).toBe(7n * ONE_CORE);
  });

  it("keeps zero and the sign of a negative amount", () => {
    expect(collateralToCore18(0n, 6)).toBe(0n);
    expect(collateralToCore18(-2_500000n, 6)).toBe(-(5n * ONE_CORE) / 2n);
  });

  it("budgets a relayed withdrawal as its amount plus the fee, both in Core units", () => {
    /** 0.016666 withdrawn plus a 0.05 fee, from a 6-decimal collateral: 0.066666 of Core balance. */
    const fee18 = collateralToCore18(50_000n, 6);
    expect(collateralToCore18(16_666n, 6) + fee18).toBe(66_666n * 10n ** 12n);
  });
});

describe("core18ToCollateral", () => {
  it("divides an exact Core amount without rounding in either direction", () => {
    expect(core18ToCollateral(ONE_CORE, 6)).toBe(1_000000n);
    expect(core18ToCollateral(ONE_CORE, 6, { rounding: "down" })).toBe(1_000000n);
    expect(core18ToCollateral(3n * 10n ** 16n, 6)).toBe(30_000n);
    expect(core18ToCollateral(0n, 6)).toBe(0n);
  });

  it("rounds a remainder up by default", () => {
    expect(core18ToCollateral(1n, 6)).toBe(1n);
    expect(core18ToCollateral(ONE_CORE + 1n, 6)).toBe(1_000001n);
    expect(core18ToCollateral(ONE_CORE - 1n, 6)).toBe(1_000000n);
  });

  it("rounds a remainder down on request", () => {
    expect(core18ToCollateral(1n, 6, { rounding: "down" })).toBe(0n);
    expect(core18ToCollateral(ONE_CORE + 1n, 6, { rounding: "down" })).toBe(1_000000n);
    expect(core18ToCollateral(ONE_CORE - 1n, 6, { rounding: "down" })).toBe(999_999n);
  });

  it("matches the (fee18 + scale - 1n) / scale funding formula for non-negative amounts", () => {
    const scale = 10n ** 12n;
    for (const fee18 of [0n, 1n, scale - 1n, scale, scale + 1n, 5n * 10n ** 16n + 7n, 123_456_789_012_345_678n]) {
      expect(core18ToCollateral(fee18, 6)).toBe((fee18 + scale - 1n) / scale);
      expect(core18ToCollateral(fee18, 6, { rounding: "down" })).toBe(fee18 / scale);
    }
  });

  it("never rounds at 18 decimals", () => {
    expect(core18ToCollateral(ONE_CORE + 1n, 18)).toBe(ONE_CORE + 1n);
    expect(core18ToCollateral(maxUint256, 18, { rounding: "down" })).toBe(maxUint256);
  });

  it("rounds whole tokens at 0 decimals", () => {
    expect(core18ToCollateral(ONE_CORE, 0)).toBe(1n);
    expect(core18ToCollateral(ONE_CORE + 1n, 0)).toBe(2n);
    expect(core18ToCollateral(ONE_CORE + 1n, 0, { rounding: "down" })).toBe(1n);
  });

  it("rounds a negative amount toward positive infinity for up and negative infinity for down", () => {
    expect(core18ToCollateral(-(ONE_CORE + 1n), 6)).toBe(-1_000000n);
    expect(core18ToCollateral(-(ONE_CORE + 1n), 6, { rounding: "down" })).toBe(-1_000001n);
    expect(core18ToCollateral(-ONE_CORE, 6, { rounding: "down" })).toBe(-1_000000n);
  });
});

describe("round trip", () => {
  it.each([0, 1, 6, 8, 17, 18])("recovers every collateral amount at %i decimals", (collateralDecimals) => {
    for (const amount of [0n, 1n, 999n, 1_000000n, 123_456_789n, -42n, 10n ** 40n]) {
      const amount18 = collateralToCore18(amount, collateralDecimals);
      expect(core18ToCollateral(amount18, collateralDecimals)).toBe(amount);
      expect(core18ToCollateral(amount18, collateralDecimals, { rounding: "down" })).toBe(amount);
    }
  });

  it("brackets a Core amount between its rounded-down and rounded-up token amounts", () => {
    const amount18 = 1_234567891234567891n;
    const down = core18ToCollateral(amount18, 6, { rounding: "down" });
    const up = core18ToCollateral(amount18, 6);
    expect(up - down).toBe(1n);
    expect(collateralToCore18(down, 6) < amount18).toBe(true);
    expect(collateralToCore18(up, 6) > amount18).toBe(true);
  });
});

describe("unsupported collateral decimals", () => {
  it.each([
    { label: "a negative count", value: -1 },
    { label: "more than 18", value: 19 },
    { label: "a fraction", value: 6.5 },
    { label: "NaN", value: Number.NaN },
    { label: "Infinity", value: Number.POSITIVE_INFINITY },
    { label: "a numeric string", value: "6" },
    { label: "a bigint", value: 6n },
    { label: "undefined", value: undefined },
  ])("rejects $label in both directions", ({ value }) => {
    const collateralDecimals = value as number;
    const expected = expect.objectContaining({ code: "COLLATERAL_DECIMALS_UNSUPPORTED", kind: "validation" });
    expect(() => collateralToCore18(1n, collateralDecimals)).toThrowError(expected);
    expect(() => core18ToCollateral(1n, collateralDecimals)).toThrowError(expected);
    expect(() => core18ToCollateral(1n, collateralDecimals, { rounding: "down" })).toThrowError(expected);
  });

  it("names the helper and the rejected value in the message", () => {
    expect(() => collateralToCore18(1n, 19)).toThrowError(/collateralToCore18: .* got 19\./);
    expect(() => core18ToCollateral(1n, "6" as unknown as number)).toThrowError(/core18ToCollateral: .* got "6"\./);
    expect(() => core18ToCollateral(1n, 6n as unknown as number)).toThrowError(/got 6n\./);
  });
});
