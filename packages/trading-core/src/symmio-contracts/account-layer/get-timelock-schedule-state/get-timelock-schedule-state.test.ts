import { encodeFunctionData, keccak256 } from "viem";
import { describe, expect, it } from "vitest";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import {
  TIMELOCK_TEST_CALL_DATA,
  TIMELOCK_TEST_ROOT,
  TIMELOCK_TEST_UNLOCKER,
  TIMELOCK_TEST_VA,
  timelockActionRig,
} from "../timelock-test";
import { getTimelockScheduleState } from "./get-timelock-schedule-state";

describe("getTimelockScheduleState", () => {
  it("derives policy-change windows from affected existing selector delays", async () => {
    const { config, readContract } = timelockActionRig();
    readContract.mockImplementation(({ functionName, args }) => {
      if (functionName === "getSchedule") return { scheduledAt: 100n, nonce: 1 };
      if (functionName === "scheduleGracePeriod") return 60n;
      if (functionName === "getSelectorTimelock")
        return { unlocker: TIMELOCK_TEST_UNLOCKER, delay: args[1] === "0x12345678" ? 1200n : 300n };
      throw new Error(`unexpected read ${functionName}`);
    });
    const callData = encodeFunctionData({
      abi: accountLayerAbi,
      functionName: "clearTimelocks",
      args: [TIMELOCK_TEST_ROOT, ["0x12345678", "0x11223344"]],
    });
    await expect(getTimelockScheduleState(config, { account: TIMELOCK_TEST_ROOT, callData })).resolves.toMatchObject({
      policy: { delay: 1200n },
      readyAt: 1300n,
      expiresAt: 1360n,
    });
    await expect(getTimelockScheduleState(config, { account: TIMELOCK_TEST_VA, callData })).rejects.toMatchObject({
      code: "TIMELOCK_POLICY_ACCOUNT_MISMATCH",
    });
  });

  it.each([0n, 1_900_000_000n])("derives the schedule window from timestamp %s", async (scheduledAt) => {
    const { config, readContract } = timelockActionRig();
    readContract.mockImplementation(({ functionName }) => {
      if (functionName === "getSchedule") return { scheduledAt, nonce: 3 };
      if (functionName === "getSelectorTimelock") return { unlocker: TIMELOCK_TEST_UNLOCKER, delay: 600n };
      if (functionName === "scheduleGracePeriod") return 90n;
      throw new Error(`unexpected read ${functionName}`);
    });
    expect(
      await getTimelockScheduleState(config, {
        account: TIMELOCK_TEST_ROOT,
        callData: TIMELOCK_TEST_CALL_DATA,
      }),
    ).toEqual({
      callDataHash: keccak256(TIMELOCK_TEST_CALL_DATA),
      schedule: { scheduledAt, nonce: 3 },
      policy: { unlocker: TIMELOCK_TEST_UNLOCKER, delay: 600n },
      gracePeriod: 90n,
      readyAt: scheduledAt === 0n ? null : scheduledAt + 600n,
      expiresAt: scheduledAt === 0n ? null : scheduledAt + 690n,
    });
  });
});
