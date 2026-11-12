import { BaseError, ContractFunctionRevertedError, encodeErrorResult } from "viem";
import { describe, expect, it } from "vitest";
import { accountLayerAbi } from "../symmio-contracts/abi/v0.8.6/account-layer";
import { rethrowTimelockRevert } from "./normalize-timelock-revert";

describe("rethrowTimelockRevert", () => {
  it("maps a nested decoded gate revert and preserves its original cause", () => {
    const data = encodeErrorResult({
      abi: accountLayerAbi,
      errorName: "TimelockOpNotApprovedOrScheduled",
      args: ["0x0000000000000000000000000000000000000001", `0x${"12".repeat(32)}`],
    });
    const inner = new ContractFunctionRevertedError({ abi: accountLayerAbi, data, functionName: "addMargin" });
    const outer = new BaseError("simulation failed", { cause: inner });
    expect(() => rethrowTimelockRevert(outer)).toThrowError(
      expect.objectContaining({ code: "TIMELOCK_REQUIRED", cause: outer }),
    );
  });

  it("preserves unrelated errors unchanged", () => {
    const error = new Error("network failed");
    expect(() => rethrowTimelockRevert(error)).toThrow(error);
  });
});
