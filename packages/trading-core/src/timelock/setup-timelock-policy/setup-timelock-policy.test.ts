import { encodeFunctionData, keccak256 } from "viem";
import { describe, expect, it, vi } from "vitest";
import { TEST_TX_HASH } from "../../shared/test/mock-config";
import { accountLayerAbi } from "../../symmio-contracts/abi/v0.8.6/account-layer";
import { INSTANT_OPEN_TIMELOCK_SELECTORS } from "../policy";
import { TimelockPolicyChangeAuthorizationError } from "../policy-change";
import { NOW, ROOT, UNLOCKER, VA, timelockRig } from "../test/fixture";
import { setupTimelockPolicy } from "./setup-timelock-policy";

describe("policy setup", () => {
  it.each([
    { label: "missing", scheduledAt: 0n },
    { label: "immature", scheduledAt: NOW - 1199n },
    { label: "expired", scheduledAt: NOW - 1261n },
  ])("reports a $label schedule before any wallet prompt or write", async ({ scheduledAt }) => {
    const { config, capability, state, readContract, writeContract, getBlock } = timelockRig();
    Object.assign(state, { unlocker: UNLOCKER, delay: 1200n });
    const originalRead = readContract.getMockImplementation()!;
    readContract.mockImplementation((call) =>
      call.functionName === "getSchedule" ? { scheduledAt, nonce: 1 } : originalRead(call),
    );
    const wallet = vi.spyOn(config, "getWalletClient");
    const failure = await setupTimelockPolicy(config, { account: VA, capability }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(TimelockPolicyChangeAuthorizationError);
    expect(failure).toMatchObject({
      code: "TIMELOCK_POLICY_CHANGE_AUTHORIZATION_REQUIRED",
      change: { account: ROOT, delay: 600n, requiredUnlockers: [UNLOCKER], scheduleDelaySeconds: 1200n },
      readyAt: scheduledAt === 0n ? null : scheduledAt + 1200n,
      expiresAt: scheduledAt === 0n ? null : scheduledAt + 1260n,
    });
    expect(getBlock).toHaveBeenCalledOnce();
    expect(wallet).not.toHaveBeenCalled();
    expect(writeContract).not.toHaveBeenCalled();
  });

  it.each([1200n, 1230n, 1260n])(
    "executes the exact scheduled reduction at age %s seconds, including window boundaries",
    async (age) => {
      const { config, capability, state, readContract, writeContract } = timelockRig();
      Object.assign(state, { unlocker: UNLOCKER, delay: 1200n });
      const originalRead = readContract.getMockImplementation()!;
      readContract.mockImplementation((call) =>
        call.functionName === "getSchedule" ? { scheduledAt: NOW - age, nonce: 1 } : originalRead(call),
      );
      writeContract.mockImplementation(async () => {
        state.delay = 600n;
        return TEST_TX_HASH;
      });
      await setupTimelockPolicy(config, { account: VA, capability });
      expect(writeContract).toHaveBeenCalledOnce();
      expect(writeContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "setupTimelocks",
          args: [ROOT, UNLOCKER, 600n, INSTANT_OPEN_TIMELOCK_SELECTORS],
        }),
      );
      const data = encodeFunctionData({
        abi: accountLayerAbi,
        functionName: "setupTimelocks",
        args: [ROOT, UNLOCKER, 600n, INSTANT_OPEN_TIMELOCK_SELECTORS],
      });
      expect(readContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "getSchedule", args: [ROOT, keccak256(data)] }),
      );
    },
  );

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
