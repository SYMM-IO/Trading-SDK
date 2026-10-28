import { describe, expect, it } from "vitest";
import type { GaslessWriteParameter } from "../../shared/types/properties";
import { getGaslessAttemptStart, withGaslessAttemptStart } from "./attempt-start";

describe("gasless attempt start", () => {
  it("tags a copy and leaves the caller's options untouched", () => {
    const options = { idempotencyKey: "action-1" };
    const tagged = withGaslessAttemptStart(options, 1_000);

    expect(tagged).toEqual(options);
    expect(tagged).not.toBe(options);
    expect(getGaslessAttemptStart(tagged)).toBe(1_000);
    expect(getGaslessAttemptStart(options)).toBeUndefined();
  });

  it("keeps the outermost action's start", () => {
    const outer = withGaslessAttemptStart({ idempotencyKey: "action-1" }, 1_000);
    const inner = withGaslessAttemptStart(outer, 5_000);

    expect(inner).toBe(outer);
    expect(getGaslessAttemptStart(inner)).toBe(1_000);
  });

  it.each<{ gasless: GaslessWriteParameter["gasless"]; relaysAs: object }>([
    { gasless: true, relaysAs: { enabled: true } },
    { gasless: false, relaysAs: { enabled: false } },
    { gasless: undefined, relaysAs: {} },
  ])("turns $gasless into options that relay the same way", ({ gasless, relaysAs }) => {
    const tagged = withGaslessAttemptStart(gasless, 1_000);

    expect(tagged).toEqual(relaysAs);
    expect(getGaslessAttemptStart(tagged)).toBe(1_000);
  });

  it("reports no start for options no action tagged", () => {
    expect(getGaslessAttemptStart(undefined)).toBeUndefined();
    expect(getGaslessAttemptStart(true)).toBeUndefined();
    expect(getGaslessAttemptStart({ enabled: true })).toBeUndefined();
  });
});
