import {
  decodeFunctionData,
  encodeFunctionData,
  getAbiItem,
  keccak256,
  toFunctionSelector,
  zeroAddress,
  type Hex,
} from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDeallocateUpnlSig } from "../muon/deallocate-upnl-sig/get-deallocate-upnl-sig";
import { TEST_TYPED_SIGNATURE, TEST_USER } from "../shared/test/mock-config";
import { accountLayerAbi } from "../symmio-contracts/abi/v0.8.6/account-layer";
import { symmioAbi } from "../symmio-contracts/abi/v0.8.6/symmio";
import { addMargin } from "../symmio-contracts/account-layer/actions/add-margin";
import { allocate } from "../symmio-contracts/symmio/actions/allocate";
import { deallocate } from "../symmio-contracts/symmio/actions/deallocate";
import { executeAccountCalls } from "../symmio-contracts/symmio/execute-account-calls/execute-account-calls";
import type { TimelockApprovalRequestPayload } from "./approval";
import { executeProtectedCoreBatch } from "./execute-protected-batch";
import { NOW, ROOT, timelockRig, UNLOCKER, VA } from "./test/fixture";

vi.mock("../muon/deallocate-upnl-sig/get-deallocate-upnl-sig", () => ({ getDeallocateUpnlSig: vi.fn() }));

function rig(lockOuter = false) {
  const result = timelockRig();
  Object.assign(result.state, { unlocker: UNLOCKER, delay: 600n });
  if (!lockOuter) {
    const previous = result.readContract.getMockImplementation()!;
    const outer = toFunctionSelector(getAbiItem({ abi: accountLayerAbi, name: "_call" }));
    result.readContract.mockImplementation((request) =>
      request.functionName === "getSelectorTimelock" && request.args[1] === outer
        ? { unlocker: zeroAddress, delay: 0n }
        : previous(request),
    );
  }
  const provider = {
    requestApproval: vi.fn(async (request: TimelockApprovalRequestPayload) => ({
      account: ROOT,
      unlocker: UNLOCKER,
      call_data_hash: keccak256(request.signedOperation.callData),
      deadline: Number(NOW + 60n),
      salt: `0x${"11".repeat(32)}` as Hex,
      signature: TEST_TYPED_SIGNATURE,
      approval_hash: `0x${"22".repeat(32)}` as Hex,
      remaining_approvals: 2,
    })),
  };
  return { ...result, provider };
}

function batchRig() {
  return rig();
}

beforeEach(() => vi.clearAllMocks());

describe("optional protected writes", () => {
  it("wraps the raw Core call and retains the original account", async () => {
    const { config, capability, provider, writeContract } = rig();
    await allocate(config, {
      account: VA,
      amount: 12n,
      gasless: false,
      timelock: { capability, provider, deadline: NOW + 300n },
    });
    const write = writeContract.mock.calls[0]![0];
    expect(provider.requestApproval).toHaveBeenCalledOnce();
    expect(write.functionName).toBe("executeTimelockOp");
    expect(decodeFunctionData({ abi: accountLayerAbi, data: write.args[1] })).toMatchObject({
      functionName: "_call",
      args: [VA, [encodeFunctionData({ abi: symmioAbi, functionName: "allocate", args: [12n] })]],
    });
  });
  it("uses the direct AccountLayer call for margin", async () => {
    const { config, capability, provider, writeContract } = rig();
    await addMargin(config, {
      virtualAccount: VA,
      amount: 12n,
      gasless: false,
      timelock: { capability, provider, deadline: NOW + 300n },
    });
    expect(decodeFunctionData({ abi: accountLayerAbi, data: writeContract.mock.calls[0]![0].args[1] })).toMatchObject({
      functionName: "addMargin",
      args: [VA, 12n],
    });
  });
  it("does not submit after an ambiguous approval failure", async () => {
    const { config, capability, provider, writeContract } = rig();
    provider.requestApproval.mockRejectedValue(new Error("timeout"));
    await expect(
      addMargin(config, {
        virtualAccount: VA,
        amount: 12n,
        gasless: false,
        timelock: { capability, provider, deadline: NOW + 300n },
      }),
    ).rejects.toThrow("timeout");
    expect(provider.requestApproval).toHaveBeenCalledOnce();
    expect(writeContract).not.toHaveBeenCalled();
  });
  it("does not issue a second approval when the same mutation is retried", async () => {
    const { config, capability, provider, writeContract } = rig();
    provider.requestApproval.mockRejectedValue(new Error("timeout"));
    const timelock = { capability, provider, deadline: NOW + 300n };
    const parameters = { virtualAccount: VA, amount: 12n, gasless: false, timelock };
    await expect(addMargin(config, parameters)).rejects.toThrow("timeout");
    await expect(addMargin(config, parameters)).rejects.toThrow("timeout");
    expect(provider.requestApproval).toHaveBeenCalledOnce();
    expect(writeContract).not.toHaveBeenCalled();
  });
  it("retains the transaction and approval without resubmitting after a hash is returned", async () => {
    const { config, capability, provider, writeContract } = rig();
    const timelock = { capability, provider, deadline: NOW + 300n };
    const parameters = { virtualAccount: VA, amount: 12n, gasless: false, timelock };
    const hash = await addMargin(config, parameters);
    await expect(addMargin(config, parameters)).rejects.toMatchObject({
      hash,
      approval: { approval: { account: ROOT } },
    });
    expect(provider.requestApproval).toHaveBeenCalledOnce();
    expect(writeContract).toHaveBeenCalledOnce();
  });
  it("rejects a reused approval for different calldata", async () => {
    const { config, writeContract } = rig();
    const approval = {
      approval: {
        account: ROOT,
        unlocker: UNLOCKER,
        callDataHash: keccak256("0x1234"),
        deadline: NOW + 60n,
        salt: `0x${"11".repeat(32)}` as Hex,
      },
      signature: TEST_TYPED_SIGNATURE,
    };
    await expect(
      addMargin(config, { virtualAccount: VA, amount: 12n, gasless: false, timelock: { approval } }),
    ).rejects.toMatchObject({ code: "TIMELOCK_APPROVAL_MISMATCH" });
    expect(writeContract).not.toHaveBeenCalled();
  });
  it("submits an existing matching approval without requesting another", async () => {
    const { config, writeContract } = rig();
    const callData = encodeFunctionData({ abi: accountLayerAbi, functionName: "addMargin", args: [VA, 12n] });
    const approval = {
      approval: {
        account: ROOT,
        unlocker: UNLOCKER,
        callDataHash: keccak256(callData),
        deadline: NOW + 60n,
        salt: `0x${"11".repeat(32)}` as Hex,
      },
      signature: TEST_TYPED_SIGNATURE,
    };
    await addMargin(config, { virtualAccount: VA, amount: 12n, gasless: false, timelock: { approval } });
    expect(writeContract.mock.calls[0]![0].args[0]).toEqual([approval]);
  });
  it("preserves the issued approval when submission fails", async () => {
    const { config, capability, provider, writeContract } = rig();
    writeContract.mockRejectedValue(new Error("wallet rejected"));
    await expect(
      addMargin(config, {
        virtualAccount: VA,
        amount: 12n,
        gasless: false,
        timelock: { capability, provider, deadline: NOW + 300n },
      }),
    ).rejects.toMatchObject({ approval: { approval: { account: ROOT } }, cause: { message: "wallet rejected" } });
    expect(provider.requestApproval).toHaveBeenCalledOnce();
  });
  it("rejects an execution wallet that is not the owner before issuance", async () => {
    const { config, capability, provider, writeContract } = rig();
    const wallet = await config.getWalletClient();
    vi.spyOn(config, "getWalletClient").mockResolvedValue({
      ...wallet,
      account: { ...wallet.account, address: UNLOCKER },
    });
    await expect(
      allocate(config, {
        account: VA,
        amount: 12n,
        from: TEST_USER,
        timelock: { capability, provider, deadline: NOW + 300n },
      }),
    ).rejects.toMatchObject({ code: "TIMELOCK_OWNER_REQUIRED" });
    expect(provider.requestApproval).not.toHaveBeenCalled();
    expect(writeContract).not.toHaveBeenCalled();
  });
  it("checks delegated execution before consuming an approval slot", async () => {
    const { config, capability, provider, readContract, writeContract } = rig();
    const wallet = await config.getWalletClient();
    vi.spyOn(config, "getWalletClient").mockResolvedValue({
      ...wallet,
      account: { ...wallet.account, address: UNLOCKER },
    });
    const previous = readContract.getMockImplementation()!;
    readContract.mockImplementation((request) =>
      request.functionName === "isDelegationActive" ? false : previous(request),
    );
    await expect(
      allocate(config, {
        account: VA,
        amount: 12n,
        from: UNLOCKER,
        gasless: true,
        timelock: { capability, provider, deadline: NOW + 300n },
      }),
    ).rejects.toMatchObject({ code: "GASLESS_SIGNER_NOT_DELEGATED" });
    expect(provider.requestApproval).not.toHaveBeenCalled();
    expect(writeContract).not.toHaveBeenCalled();
  });

  it("rejects a delegated signer using another account family before issuance", async () => {
    const { config, capability, provider, writeContract } = rig();
    const wallet = await config.getWalletClient();
    vi.spyOn(config, "getWalletClient").mockResolvedValue({
      ...wallet,
      account: { ...wallet.account, address: UNLOCKER },
    });
    await expect(
      allocate(config, {
        account: VA,
        amount: 12n,
        from: UNLOCKER,
        gasless: { enabled: true, account: TEST_USER },
        timelock: { capability, provider, deadline: NOW + 300n },
      }),
    ).rejects.toMatchObject({ code: "TIMELOCK_GASLESS_ACCOUNT_MISMATCH" });
    expect(provider.requestApproval).not.toHaveBeenCalled();
    expect(writeContract).not.toHaveBeenCalled();
  });
  it("submits two independently approved Core calls atomically", async () => {
    const { config, capability, provider, writeContract } = batchRig();
    const calls = [
      encodeFunctionData({ abi: symmioAbi, functionName: "allocate", args: [12n] }),
      encodeFunctionData({ abi: symmioAbi, functionName: "allocate", args: [13n] }),
    ];
    await executeProtectedCoreBatch(config, {
      account: VA,
      callDatas: calls,
      gasless: false,
      timelock: {
        calls: [
          { capability, provider, deadline: NOW + 300n },
          { capability, provider, deadline: NOW + 300n },
        ],
      },
    });
    const write = writeContract.mock.calls[0]![0];
    expect(provider.requestApproval).toHaveBeenCalledTimes(2);
    expect(write.args[0].map((entry: { approval: { callDataHash: Hex } }) => entry.approval.callDataHash)).toEqual(
      calls.map((call) => keccak256(call)),
    );
    expect(decodeFunctionData({ abi: accountLayerAbi, data: write.args[1] })).toMatchObject({
      functionName: "_call",
      args: [VA, calls],
    });
  });

  it("keeps named Core calls atomic when explicit batch authorization is supplied", async () => {
    const { config, capability, provider, writeContract } = batchRig();
    await executeAccountCalls(config, {
      account: VA,
      gasless: false,
      calls: [
        { functionName: "allocate", args: [12n] },
        { functionName: "allocate", args: [13n] },
      ],
      timelock: {
        calls: [
          { capability, provider, deadline: NOW + 300n },
          { capability, provider, deadline: NOW + 300n },
        ],
      },
    });
    const write = writeContract.mock.calls[0]![0];
    expect(write.functionName).toBe("executeTimelockOp");
    expect(write.args[0]).toHaveLength(2);
    expect(provider.requestApproval).toHaveBeenCalledTimes(2);
  });
  it("preserves earlier approvals if a later batch approval fails", async () => {
    const { config, capability, writeContract } = batchRig();
    const secondProvider = { requestApproval: vi.fn().mockRejectedValue(new Error("timeout")) };
    const firstProvider = rig().provider;
    const calls = [
      encodeFunctionData({ abi: symmioAbi, functionName: "allocate", args: [12n] }),
      encodeFunctionData({ abi: symmioAbi, functionName: "allocate", args: [13n] }),
    ];
    const timelock = {
      calls: [
        { capability, provider: firstProvider, deadline: NOW + 300n },
        { capability, provider: secondProvider, deadline: NOW + 300n },
      ],
    };
    await expect(executeProtectedCoreBatch(config, { account: VA, callDatas: calls, timelock })).rejects.toMatchObject({
      approvals: [{ approval: { callDataHash: keccak256(calls[0]!) } }],
      callDatas: calls,
    });
    await expect(executeProtectedCoreBatch(config, { account: VA, callDatas: calls, timelock })).rejects.toThrow();
    expect(firstProvider.requestApproval).toHaveBeenCalledOnce();
    expect(secondProvider.requestApproval).toHaveBeenCalledOnce();
    expect(writeContract).not.toHaveBeenCalled();
  });
  it("does not reuse an authorization in another batch", async () => {
    const { config, capability, provider, writeContract } = batchRig();
    provider.requestApproval.mockRejectedValue(new Error("timeout"));
    const callDatas = [encodeFunctionData({ abi: symmioAbi, functionName: "allocate", args: [12n] })];
    const authorization = { capability, provider, deadline: NOW + 300n };
    await expect(
      executeProtectedCoreBatch(config, { account: VA, callDatas, timelock: { calls: [authorization] } }),
    ).rejects.toThrow("timeout");
    await expect(
      executeProtectedCoreBatch(config, { account: VA, callDatas, timelock: { calls: [authorization] } }),
    ).rejects.toThrow("timeout");
    expect(provider.requestApproval).toHaveBeenCalledOnce();
    expect(writeContract).not.toHaveBeenCalled();
  });
  it("rejects a protected retry before fetching a new Muon signature", async () => {
    const { config, capability, provider } = rig();
    provider.requestApproval.mockRejectedValue(new Error("timeout"));
    const timelock = { capability, provider, deadline: NOW + 300n };
    const upnlSig = {
      reqId: "0x1234" as Hex,
      timestamp: NOW,
      upnl: 0n,
      gatewaySignature: "0xabcd" as Hex,
      sigs: { signature: 1n, owner: TEST_USER, nonce: TEST_USER },
    };
    await expect(deallocate(config, { account: VA, amount: 12n, upnlSig, timelock })).rejects.toThrow("timeout");
    await expect(deallocate(config, { account: VA, amount: 12n, timelock })).rejects.toThrow("timeout");
    expect(getDeallocateUpnlSig).not.toHaveBeenCalled();
    expect(provider.requestApproval).toHaveBeenCalledOnce();
  });
  it("does not request approvals if the outer _call is also locked", async () => {
    const { config, capability, provider, writeContract } = rig(true);
    const callDatas = [encodeFunctionData({ abi: symmioAbi, functionName: "allocate", args: [12n] })];
    await expect(
      executeProtectedCoreBatch(config, {
        account: VA,
        callDatas,
        timelock: { calls: [{ capability, provider, deadline: NOW + 300n }] },
      }),
    ).rejects.toMatchObject({ code: "TIMELOCK_BATCH_OUTER_UNSUPPORTED" });
    expect(provider.requestApproval).not.toHaveBeenCalled();
    expect(writeContract).not.toHaveBeenCalled();
  });
});
