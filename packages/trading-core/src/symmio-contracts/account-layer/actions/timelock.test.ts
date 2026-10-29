import { encodeFunctionData, keccak256, type Address, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { accountLayerAbi } from "../../abi/v0.8.6/account-layer";
import {
  cancelTimelockOp,
  executeTimelockOp,
  getTimelockScheduleState,
  scheduleTimelockOp,
  setupTimelocks,
} from "./timelock";

const ROOT: Address = "0x2222222222222222222222222222222222222222";
const VIRTUAL_ACCOUNT: Address = "0x3333333333333333333333333333333333333333";
const UNLOCKER: Address = "0x4444444444444444444444444444444444444444";
const CALL_DATA: Hex = "0xb48c2317aabb";

function rootRig() {
  const rig = mockConfig();
  rig.readContract.mockImplementation(({ functionName }: { functionName: string }) => {
    if (functionName === "getVirtualAccount") return { isExists: false, parentAccount: ROOT };
    if (functionName === "minTimelockDelay") return 300n;
    throw new Error(`unexpected read ${functionName}`);
  });
  return rig;
}

describe("AccountLayer timelock writes", () => {
  it("derives policy-change schedule windows from affected existing selector delays", async () => {
    const { config, readContract } = rootRig();
    readContract.mockImplementation(({ functionName, args }) => {
      if (functionName === "getSchedule") return { scheduledAt: 100n, nonce: 1 };
      if (functionName === "scheduleGracePeriod") return 60n;
      if (functionName === "getSelectorTimelock")
        return { unlocker: UNLOCKER, delay: args[1] === "0x12345678" ? 1200n : 300n };
      throw new Error(`unexpected read ${functionName}`);
    });
    const callData = encodeFunctionData({
      abi: accountLayerAbi,
      functionName: "clearTimelocks",
      args: [ROOT, ["0x12345678", "0x11223344"]],
    });
    await expect(getTimelockScheduleState(config, { account: ROOT, callData })).resolves.toMatchObject({
      policy: { delay: 1200n },
      readyAt: 1300n,
      expiresAt: 1360n,
    });
    const setup = encodeFunctionData({
      abi: accountLayerAbi,
      functionName: "setupTimelocks",
      args: [ROOT, UNLOCKER, 600n, ["0x12345678", "0x11223344"]],
    });
    await expect(getTimelockScheduleState(config, { account: ROOT, callData: setup })).resolves.toMatchObject({
      policy: { delay: 1200n },
      readyAt: 1300n,
      expiresAt: 1360n,
      requiresSchedule: true,
    });
    const increase = encodeFunctionData({
      abi: accountLayerAbi,
      functionName: "setupTimelocks",
      args: [ROOT, UNLOCKER, 1500n, ["0x12345678", "0x11223344"]],
    });
    await expect(getTimelockScheduleState(config, { account: ROOT, callData: increase })).resolves.toMatchObject({
      requiresSchedule: false,
      readyAt: null,
      expiresAt: null,
    });
    expect(readContract.mock.calls.every(([call]) => call.blockNumber === 1n)).toBe(true);
    await expect(getTimelockScheduleState(config, { account: VIRTUAL_ACCOUNT, callData: setup })).rejects.toMatchObject(
      {
        code: "TIMELOCK_POLICY_ACCOUNT_MISMATCH",
      },
    );
  });
  it("reports unsupported deployments before attempting reads or writes", async () => {
    const { config, readContract, writeContract } = rootRig();
    await expect(
      scheduleTimelockOp(config, { account: ROOT, callData: CALL_DATA, chainId: 8453 }),
    ).rejects.toMatchObject({ code: "TIMELOCK_NOT_SUPPORTED" });
    expect(readContract).not.toHaveBeenCalled();
    expect(writeContract).not.toHaveBeenCalled();
  });
  it("checks both minimum delays and configures selectors on the root account", async () => {
    const { config, writeContract } = rootRig();
    const hash = await setupTimelocks(config, {
      account: ROOT,
      unlocker: UNLOCKER,
      delay: 600n,
      providerMinimumDelay: 600n,
      selectors: [CALL_DATA],
    });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "setupTimelocks",
        args: [ROOT, UNLOCKER, 600n, ["0xb48c2317"]],
      }),
    );
  });

  it("rejects a delay below either required minimum before writing", async () => {
    const { config, writeContract } = rootRig();
    await expect(
      setupTimelocks(config, {
        account: ROOT,
        unlocker: UNLOCKER,
        delay: 599n,
        providerMinimumDelay: 600n,
        selectors: [CALL_DATA],
      }),
    ).rejects.toThrow(/required minimum 600/);
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("rejects policy and schedule writes addressed to a virtual account", async () => {
    const { config, readContract, writeContract } = rootRig();
    readContract.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "getVirtualAccount") return { isExists: true, parentAccount: ROOT };
      throw new Error(`unexpected read ${functionName}`);
    });

    await expect(scheduleTimelockOp(config, { account: VIRTUAL_ACCOUNT, callData: CALL_DATA })).rejects.toMatchObject({
      code: "TIMELOCK_ROOT_ACCOUNT_REQUIRED",
    });
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("schedules the hash of the exact raw operation calldata", async () => {
    const { config, writeContract } = rootRig();
    await scheduleTimelockOp(config, { account: ROOT, callData: CALL_DATA });
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "scheduleTimelockOp",
        args: [ROOT, keccak256(CALL_DATA)],
      }),
    );
  });
  it("cancels the same raw calldata hash without executing a withdrawal", async () => {
    const { config, writeContract } = rootRig();
    await cancelTimelockOp(config, { account: ROOT, callData: CALL_DATA });
    expect(writeContract).toHaveBeenCalledOnce();
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "cancelTimelockOp",
        args: [ROOT, keccak256(CALL_DATA)],
      }),
    );
  });
  it.each([0n, 1_900_000_000n])("derives schedule window from on-chain timestamp %s", async (scheduledAt) => {
    const { config, readContract } = rootRig();
    readContract.mockImplementation(({ functionName }) => {
      if (functionName === "getSchedule") return { scheduledAt, nonce: 3 };
      if (functionName === "getSelectorTimelock") return { unlocker: UNLOCKER, delay: 600n };
      if (functionName === "scheduleGracePeriod") return 90n;
      throw new Error(`unexpected read ${functionName}`);
    });
    expect(await getTimelockScheduleState(config, { account: ROOT, callData: CALL_DATA })).toEqual({
      callDataHash: keccak256(CALL_DATA),
      schedule: { scheduledAt, nonce: 3 },
      policy: { unlocker: UNLOCKER, delay: 600n },
      gracePeriod: 90n,
      readyAt: scheduledAt === 0n ? null : scheduledAt + 600n,
      expiresAt: scheduledAt === 0n ? null : scheduledAt + 690n,
    });
  });
  it("executes the exact caller-supplied inner call with no approvals for delayed fallback", async () => {
    const { config, writeContract } = rootRig();
    await executeTimelockOp(config, { account: ROOT, innerCallData: CALL_DATA, approvals: [] });
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "executeTimelockOp",
        args: [[], CALL_DATA],
      }),
    );
  });
});
