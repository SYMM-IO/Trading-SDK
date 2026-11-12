import { describe, expect, it } from "vitest";
import { INSTANT_OPEN_TIMELOCK_SELECTORS } from "../policy";
import { ROOT, UNLOCKER, VA, timelockRig } from "../test/fixture";
import { getTimelockPolicy } from "./get-timelock-policy";

describe("complete timelock policy", () => {
  it("reports all 22 missing selectors on the resolved root of a VA", async () => {
    const { config, capability, readContract } = timelockRig();
    const report = await getTimelockPolicy(config, { account: VA, capability });
    expect(report.rootAccount).toBe(ROOT);
    expect(report.selectors.map((item) => [item.selector, item.status])).toEqual(
      INSTANT_OPEN_TIMELOCK_SELECTORS.map((selector) => [selector, "missing"]),
    );
    expect(
      readContract.mock.calls
        .filter(([call]) => call.functionName === "getSelectorTimelock")
        .every(([call]) => call.args[0] === ROOT),
    ).toBe(true);
  });
  it.each([
    { unlocker: ROOT, delay: 900n, status: "wrong-unlocker" },
    { unlocker: UNLOCKER, delay: 599n, status: "delay-too-short" },
    { unlocker: UNLOCKER, delay: 600n, status: "ok" },
  ])("reports $status for the observed policy", async ({ unlocker, delay, status }) => {
    const { config, capability, state } = timelockRig();
    Object.assign(state, { unlocker, delay });
    const report = await getTimelockPolicy(config, { account: ROOT, capability });
    expect(report.selectors.map((item) => item.status)).toEqual(Array(22).fill(status));
    expect(report.ready).toBe(status === "ok");
  });
  it("detects a raised provider minimum without hiding old policies", async () => {
    const { config, capability, state } = timelockRig();
    Object.assign(state, { unlocker: UNLOCKER, delay: 600n });
    capability.minTimelockDelaySeconds = 900;
    const report = await getTimelockPolicy(config, { account: VA, capability });
    expect(report.requiredDelay).toBe(900n);
    expect(report.selectors[0]).toMatchObject({ delay: 600n, status: "delay-too-short" });
  });
  it("honors a contract minimum greater than the provider minimum", async () => {
    const { config, capability, state } = timelockRig();
    Object.assign(state, { minimum: 1200n, unlocker: UNLOCKER, delay: 900n });
    const report = await getTimelockPolicy(config, { account: ROOT, capability });
    expect(report.requiredDelay).toBe(1200n);
    expect(report.ready).toBe(false);
  });
});
