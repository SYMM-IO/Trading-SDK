import { describe, expect, it } from "vitest";
import { SymmError } from "../shared/errors/symm-error";
import { CANDLE_RESOLUTION_MS, resolutionToMs } from "./resolution";
import type { CandleResolution } from "./types";

describe("resolutionToMs", () => {
  it("returns the nominal span of a resolution", () => {
    expect(resolutionToMs("1s")).toBe(1_000);
    expect(resolutionToMs("1m")).toBe(60_000);
    expect(resolutionToMs("1h")).toBe(3_600_000);
    expect(resolutionToMs("1d")).toBe(86_400_000);
  });

  it("covers every resolution in the union with a strictly increasing span", () => {
    const resolutions = Object.keys(CANDLE_RESOLUTION_MS) as CandleResolution[];
    const spans = resolutions.map(resolutionToMs);

    for (let index = 1; index < spans.length; index++) {
      expect(spans[index]!).toBeGreaterThan(spans[index - 1]!);
    }
  });

  it("throws for an unknown resolution", () => {
    expect(() => resolutionToMs("2s" as CandleResolution)).toThrow(SymmError);
  });
});
