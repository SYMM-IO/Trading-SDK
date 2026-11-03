import { getAddress } from "viem";
import { describe, expect, it } from "vitest";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { executeAccountCallsMutationOptions } from "./query";

const SUB_ACCOUNT = getAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
const CALLS = [{ functionName: "finalizeWithdrawRequest", args: [SUB_ACCOUNT, 42n] }];

describe("executeAccountCallsMutationOptions", () => {
  it("uses a stable mutation key", () => {
    const { config } = mockConfig();

    expect(executeAccountCallsMutationOptions(config).mutationKey).toEqual(["executeAccountCalls"]);
  });

  it("forwards execution overrides and checks the explicit signer is the owner", async () => {
    const { config, readContract, simulateContract, writeContract } = mockConfig();
    readContract.mockResolvedValue({ isExists: true, owner: TEST_USER });

    await executeAccountCallsMutationOptions(config).mutationFn({
      account: SUB_ACCOUNT,
      calls: CALLS,
      from: TEST_USER,
      gasless: false,
      simulateBeforeWrite: false,
    });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getSubAccount", args: [SUB_ACCOUNT] }),
    );
    expect(simulateContract).not.toHaveBeenCalled();
    expect(writeContract).toHaveBeenCalledTimes(1);
  });
});
