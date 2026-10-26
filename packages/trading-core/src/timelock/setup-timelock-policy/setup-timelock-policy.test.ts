import { describe, expect, it, vi } from "vitest";
import { TEST_TX_HASH } from "../../shared/test/mock-config";
import { INSTANT_OPEN_TIMELOCK_SELECTORS } from "../policy";
import { ROOT, UNLOCKER, VA, timelockRig } from "../test/fixture";
import { setupTimelockPolicy } from "./setup-timelock-policy";

describe("policy setup", () => {
  it("sets all selectors on the root with safe defaults and does not claim indexing", async () => {
    const { config, capability, writeContract, state } = timelockRig();
    writeContract.mockImplementation(async () => {
      Object.assign(state, { unlocker: UNLOCKER, delay: 600n });
      return TEST_TX_HASH;
    });
    const result = await setupTimelockPolicy(config, { account: VA, capability });
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "setupTimelocks",
        args: [ROOT, UNLOCKER, 600n, INSTANT_OPEN_TIMELOCK_SELECTORS],
      }),
    );
    expect(result).toMatchObject({
      hash: TEST_TX_HASH,
      receipt: { status: "success" },
      indexing: "unknown",
      policy: { ready: true },
    });
  });
  it("only reports indexed from a read-only observer after confirmation", async () => {
    const { config, capability, waitForTransactionReceipt } = timelockRig();
    const indexer = {
      getStatus: vi.fn(async () => {
        expect(waitForTransactionReceipt).toHaveBeenCalledOnce();
        return "indexed" as const;
      }),
    };
    expect(await setupTimelockPolicy(config, { account: VA, capability, indexer })).toMatchObject({
      indexing: "indexed",
    });
  });
  it("retains the original hash on a reverted receipt and never probes indexing", async () => {
    const { config, capability, waitForTransactionReceipt, writeContract } = timelockRig();
    waitForTransactionReceipt.mockResolvedValue({ status: "reverted" });
    const indexer = { getStatus: vi.fn() };
    await expect(setupTimelockPolicy(config, { account: VA, capability, indexer })).rejects.toMatchObject({
      hash: TEST_TX_HASH,
      cause: { code: "TIMELOCK_TRANSACTION_REVERTED" },
    });
    expect(writeContract).toHaveBeenCalledOnce();
    expect(indexer.getStatus).not.toHaveBeenCalled();
  });
  it("rejects a deliberately insufficient delay before submission", async () => {
    const { config, capability, writeContract } = timelockRig();
    await expect(setupTimelockPolicy(config, { account: VA, capability, delay: 599n })).rejects.toThrow(
      /required minimum/,
    );
    expect(writeContract).not.toHaveBeenCalled();
  });
});
