import { keccak256 } from "viem";
import { describe, expect, it } from "vitest";
import { TIMELOCK_TEST_CALL_DATA, TIMELOCK_TEST_ROOT, timelockActionRig } from "../timelock-test";
import { cancelTimelockOp } from "./cancel-timelock-op";

describe("cancelTimelockOp", () => {
  it("cancels the same raw calldata hash without executing it", async () => {
    const { config, writeContract } = timelockActionRig();
    await cancelTimelockOp(config, { account: TIMELOCK_TEST_ROOT, callData: TIMELOCK_TEST_CALL_DATA });
    expect(writeContract).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        functionName: "cancelTimelockOp",
        args: [TIMELOCK_TEST_ROOT, keccak256(TIMELOCK_TEST_CALL_DATA)],
      }),
    );
  });
});
