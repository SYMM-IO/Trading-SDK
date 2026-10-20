import { describe, expect, expectTypeOf, it } from "vitest";
import { toSolverDailyVolume, type SolverDailyVolume } from "../../index";

describe("public daily-volume mapper compatibility", () => {
  it("returns a non-optional row and preserves decimal strings for direct consumers", () => {
    const raw = { timestamp: "2026-10-17T00:00:00Z", volume: "448.699250908231105583" };
    expectTypeOf(toSolverDailyVolume).returns.toEqualTypeOf<SolverDailyVolume>();
    const volume: string = toSolverDailyVolume(raw).volume;
    expect(volume).toBe(raw.volume);
    expect(toSolverDailyVolume(raw)).toEqual(raw);
  });

  it.each([
    { raw: {}, expected: { timestamp: "", volume: "0" } },
    { raw: { timestamp: "2026-10-17T00:00:00Z" }, expected: { timestamp: "2026-10-17T00:00:00Z", volume: "0" } },
    { raw: { volume: "0" }, expected: { timestamp: "", volume: "0" } },
  ])("retains missing-field defaults for $raw", ({ raw, expected }) => {
    expect(toSolverDailyVolume(raw)).toEqual(expected);
  });
});
