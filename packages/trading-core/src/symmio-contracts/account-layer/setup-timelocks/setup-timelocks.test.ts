import { describe, expect, it } from "vitest";
import { TEST_TX_HASH } from "../../../shared/test/mock-config";
import {
  TIMELOCK_TEST_CALL_DATA,
  TIMELOCK_TEST_ROOT,
  TIMELOCK_TEST_UNLOCKER,
  timelockActionRig,
} from "../timelock-test";
import { setupTimelocks } from "./setup-timelocks";

describe("setupTimelocks", () => {
  it("checks both minimum delays and configures normalized selectors", async () => {
    const { config, writeContract } = timelockActionRig();
    await expect(
      setupTimelocks(config, {
        account: TIMELOCK_TEST_ROOT,
        unlocker: TIMELOCK_TEST_UNLOCKER,
        delay: 600n,
        providerMinimumDelay: 600n,
        selectors: [TIMELOCK_TEST_CALL_DATA],
      }),
    ).resolves.toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "setupTimelocks",
        args: [TIMELOCK_TEST_ROOT, TIMELOCK_TEST_UNLOCKER, 600n, ["0xb48c2317"]],
      }),
    );
  });

  it("rejects a delay below either minimum before writing", async () => {
    const { config, writeContract } = timelockActionRig();
    await expect(
      setupTimelocks(config, {
        account: TIMELOCK_TEST_ROOT,
        unlocker: TIMELOCK_TEST_UNLOCKER,
        delay: 599n,
        providerMinimumDelay: 600n,
        selectors: [TIMELOCK_TEST_CALL_DATA],
      }),
    ).rejects.toThrow(/required minimum 600/);
    expect(writeContract).not.toHaveBeenCalled();
  });
});
