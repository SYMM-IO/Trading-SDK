import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../../../core/config";
import { PositionType } from "./types";

const getEstimatedPrice = vi.hoisted(() => vi.fn());

vi.mock("../../estimated-price/get-estimated-price", () => ({ getEstimatedPrice }));

import {
  assertOpenEstimateWithinSlippage,
  assertValidSlippage,
  deriveAutoSlippage,
  fetchOpenEstimatePrice,
} from "./open-estimate-guard";

const config = {} as Config;

/** Mark 100, 5% tolerance — the band is [95, 105]. */
const PARAMS = {
  symbolId: 1,
  positionType: PositionType.LONG,
  quantity: "10",
  markPrice: "100",
  slippage: 5,
};

describe("assertValidSlippage", () => {
  it.each([0, 1, 5, 99.9])("accepts %s", (slippage) => {
    expect(() => assertValidSlippage(slippage)).not.toThrow();
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1, 100, 150])("rejects %s with INVALID_SLIPPAGE", (slippage) => {
    expect(() => assertValidSlippage(slippage)).toThrow(/Invalid slippage/);
  });
});

describe("assertOpenEstimateWithinSlippage", () => {
  beforeEach(() => {
    getEstimatedPrice.mockReset();
  });

  it("passes when the expected fill sits inside the tolerance band", async () => {
    getEstimatedPrice.mockResolvedValue({ estimatedPrice: "104" });

    await expect(assertOpenEstimateWithinSlippage(config, PARAMS)).resolves.toBeUndefined();
  });

  it("passes on the exact tolerance boundary (epsilon guard)", async () => {
    getEstimatedPrice.mockResolvedValue({ estimatedPrice: "105" });

    await expect(assertOpenEstimateWithinSlippage(config, PARAMS)).resolves.toBeUndefined();
  });

  it("rejects with SLIPPAGE_EXCEEDED when the fill deviates above the band", async () => {
    getEstimatedPrice.mockResolvedValue({ estimatedPrice: "105.02" });

    await expect(assertOpenEstimateWithinSlippage(config, PARAMS)).rejects.toThrow(/slippage tolerance/);
  });

  it("rejects on deviation below mark too — the band is absolute", async () => {
    getEstimatedPrice.mockResolvedValue({ estimatedPrice: "94" });

    await expect(assertOpenEstimateWithinSlippage(config, PARAMS)).rejects.toThrow(/slippage tolerance/);
  });

  it("asks with a wide fixed request bound, not the user's slippage (LONG above, SHORT below mark)", async () => {
    getEstimatedPrice.mockResolvedValue({ estimatedPrice: "100" });

    await assertOpenEstimateWithinSlippage(config, PARAMS);
    expect(getEstimatedPrice).toHaveBeenLastCalledWith(
      config,
      expect.objectContaining({ price: "150", entry: "open" }),
    );

    await assertOpenEstimateWithinSlippage(config, { ...PARAMS, positionType: PositionType.SHORT });
    expect(getEstimatedPrice).toHaveBeenLastCalledWith(config, expect.objectContaining({ price: "50" }));
  });

  it("skips the gate when the estimate request fails", async () => {
    getEstimatedPrice.mockRejectedValue(new Error("solver down"));

    await expect(assertOpenEstimateWithinSlippage(config, PARAMS)).resolves.toBeUndefined();
  });

  it("skips the gate on a zero estimate", async () => {
    getEstimatedPrice.mockResolvedValue({ estimatedPrice: "0" });

    await expect(assertOpenEstimateWithinSlippage(config, PARAMS)).resolves.toBeUndefined();
  });

  it("skips the gate entirely on a zero mark price", async () => {
    await expect(assertOpenEstimateWithinSlippage(config, { ...PARAMS, markPrice: "0" })).resolves.toBeUndefined();
    expect(getEstimatedPrice).not.toHaveBeenCalled();
  });

  it("gates against a pre-fetched estimate without re-asking the solver", async () => {
    await expect(assertOpenEstimateWithinSlippage(config, { ...PARAMS, expectedFillPrice: "105.02" })).rejects.toThrow(
      /slippage tolerance/,
    );
    expect(getEstimatedPrice).not.toHaveBeenCalled();
  });
});

describe("fetchOpenEstimatePrice", () => {
  beforeEach(() => {
    getEstimatedPrice.mockReset();
  });

  it("returns the solver's estimate, requested with the wide fixed bound", async () => {
    getEstimatedPrice.mockResolvedValue({ estimatedPrice: "101.5" });

    await expect(fetchOpenEstimatePrice(config, PARAMS)).resolves.toBe("101.5");
    expect(getEstimatedPrice).toHaveBeenCalledWith(config, expect.objectContaining({ price: "150", entry: "open" }));
  });

  it("returns undefined on a request failure", async () => {
    getEstimatedPrice.mockRejectedValue(new Error("solver down"));

    await expect(fetchOpenEstimatePrice(config, PARAMS)).resolves.toBeUndefined();
  });

  it("returns undefined on a zero estimate", async () => {
    getEstimatedPrice.mockResolvedValue({ estimatedPrice: "0" });

    await expect(fetchOpenEstimatePrice(config, PARAMS)).resolves.toBeUndefined();
  });

  it("returns undefined without asking on a zero mark price", async () => {
    await expect(fetchOpenEstimatePrice(config, { ...PARAMS, markPrice: "0" })).resolves.toBeUndefined();
    expect(getEstimatedPrice).not.toHaveBeenCalled();
  });
});

describe("deriveAutoSlippage", () => {
  it("LONG: bound = estimate × 1.04, expressed as percent off mark", () => {
    // 102 × 1.04 / 100 − 1 = 6.08%
    expect(deriveAutoSlippage({ markPrice: "100", expectedFillPrice: "102", positionType: PositionType.LONG })).toBe(
      6.08,
    );
  });

  it("SHORT: bound = estimate × 0.96, expressed as percent off mark", () => {
    // 1 − 98 × 0.96 / 100 = 5.92%
    expect(deriveAutoSlippage({ markPrice: "100", expectedFillPrice: "98", positionType: PositionType.SHORT })).toBe(
      5.92,
    );
  });

  it("clamps to 0 when the bound lands inside the mark", () => {
    // 90 × 1.04 = 93.6 < mark → negative percent → 0
    expect(deriveAutoSlippage({ markPrice: "100", expectedFillPrice: "90", positionType: PositionType.LONG })).toBe(0);
  });

  it("falls back to a flat 4% when the estimate is unavailable", () => {
    expect(
      deriveAutoSlippage({ markPrice: "100", expectedFillPrice: undefined, positionType: PositionType.LONG }),
    ).toBe(4);
    expect(deriveAutoSlippage({ markPrice: "0", expectedFillPrice: "102", positionType: PositionType.LONG })).toBe(4);
  });
});
