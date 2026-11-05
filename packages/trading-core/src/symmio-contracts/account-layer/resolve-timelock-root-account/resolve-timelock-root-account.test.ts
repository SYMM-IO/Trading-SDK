import { describe, expect, it } from "vitest";
import { TIMELOCK_TEST_ROOT, TIMELOCK_TEST_VA, timelockActionRig } from "../timelock-test";
import { resolveTimelockRootAccount } from "./resolve-timelock-root-account";

describe("resolveTimelockRootAccount", () => {
  it("resolves a deleted virtual account through its retained parent mapping", async () => {
    const { config } = timelockActionRig();
    await expect(resolveTimelockRootAccount(config, { account: TIMELOCK_TEST_VA })).resolves.toBe(TIMELOCK_TEST_ROOT);
  });
});
