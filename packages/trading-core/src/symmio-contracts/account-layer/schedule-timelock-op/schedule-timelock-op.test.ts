import { keccak256 } from "viem";
import { describe, expect, it } from "vitest";
import { TIMELOCK_TEST_CALL_DATA, TIMELOCK_TEST_ROOT, timelockActionRig } from "../timelock-test";
import { scheduleTimelockOp } from "./schedule-timelock-op";

describe("scheduleTimelockOp", () => {
  it("rejects unsupported deployments before attempting reads or writes", async () => {
    const { config, readContract, writeContract } = timelockActionRig();
    await expect(
      scheduleTimelockOp(config, { account: TIMELOCK_TEST_ROOT, callData: TIMELOCK_TEST_CALL_DATA, chainId: 8453 }),
    ).rejects.toMatchObject({ code: "TIMELOCK_NOT_SUPPORTED" });
    expect(readContract).not.toHaveBeenCalled();
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("schedules the hash of the exact raw operation calldata", async () => {
    const { config, writeContract } = timelockActionRig();
    await scheduleTimelockOp(config, { account: TIMELOCK_TEST_ROOT, callData: TIMELOCK_TEST_CALL_DATA });
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "scheduleTimelockOp",
        args: [TIMELOCK_TEST_ROOT, keccak256(TIMELOCK_TEST_CALL_DATA)],
      }),
    );
  });
});
