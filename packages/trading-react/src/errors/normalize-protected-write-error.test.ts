import { TimelockBatchExecutionError, TimelockSolverError } from "@symmio/trading-core";
import { describe, expect, it } from "vitest";
import { normalizeProtectedWriteError } from "./normalize-protected-write-error";

describe("protected error classification", () => {
  it("keeps typed solver details and partial approvals when a later batch approval fails", () => {
    const solver = new TimelockSolverError({
      code: "SOLVER_ERROR",
      message: "failed",
      status: 400,
      statusText: "Bad Request",
      url: "/timelock-approval",
      method: "POST",
      responseData: { code: 3703, error_category: "validation", error_message: "Pending open" },
    });
    const approval = {
      approval: {
        account: "0x1111111111111111111111111111111111111111" as const,
        unlocker: "0x2222222222222222222222222222222222222222" as const,
        callDataHash: `0x${"11".repeat(32)}` as `0x${string}`,
        deadline: 2_000_000_000n,
        salt: `0x${"22".repeat(32)}` as `0x${string}`,
      },
      signature: "0x1234" as const,
    };
    const wrapped = new TimelockBatchExecutionError([approval], ["0x12345678"], solver);
    const normalized = normalizeProtectedWriteError(wrapped, { calls: [] });
    expect(normalized).toMatchObject({
      kind: "api",
      code: "3703",
      status: 400,
      timelock: { knownCode: 3703 },
      cause: { approvals: [approval], callDatas: ["0x12345678"] },
    });
  });
});
