import { describe, expect, it } from "vitest";
import { TIMELOCK_TEST_CALL_DATA, TIMELOCK_TEST_ROOT, timelockActionRig } from "../timelock-test";
import { executeTimelockOp } from "./execute-timelock-op";

describe("executeTimelockOp", () => {
  it("executes the exact inner call without approvals for mature delayed fallback", async () => {
    const { config, writeContract } = timelockActionRig();
    await executeTimelockOp(config, { account: TIMELOCK_TEST_ROOT, innerCallData: TIMELOCK_TEST_CALL_DATA });
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "executeTimelockOp", args: [[], TIMELOCK_TEST_CALL_DATA] }),
    );
  });
});
