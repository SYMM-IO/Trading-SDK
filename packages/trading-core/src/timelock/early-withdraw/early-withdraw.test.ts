import { decodeFunctionData, keccak256, zeroAddress, type Hex } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitGaslessWrite } from "../../gasless/dispatch/submit-gasless-write";
import { TEST_GASLESS } from "../../gasless/test/config";
import { TEST_TX_HASH, TEST_TYPED_SIGNATURE, TEST_USER } from "../../shared/test/mock-config";
import { accountLayerAbi } from "../../symmio-contracts/abi/v0.8.6/account-layer";
import { symmioAbi } from "../../symmio-contracts/abi/v0.8.6/symmio";
import type { TimelockApprovalRequestPayload } from "../approval";
import { NOW, ROOT, timelockRig, UNLOCKER, VA } from "../test/fixture";
import { earlyWithdraw, type EarlyWithdrawalCall } from "./early-withdraw";

vi.mock("../../gasless/dispatch/submit-gasless-write", () => ({ submitGaslessWrite: vi.fn() }));
const RELAY_HASH = `0x${"ef".repeat(32)}` as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(submitGaslessWrite).mockResolvedValue({ kind: "broadcast", hash: RELAY_HASH });
});
afterEach(() => vi.restoreAllMocks());

function rig() {
  const result = timelockRig();
  Object.assign(result.state, { unlocker: UNLOCKER, delay: 600n });
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

describe("early withdrawal", () => {
  const variants: EarlyWithdrawalCall[] = [
    { method: "withdraw", amount: 2n ** 80n + 42n },
    { method: "withdrawTo", amount: 2n ** 80n + 42n, recipient: TEST_USER },
    {
      method: "initiateWithdraw",
      parts: [
        {
          id: 0n,
          amount: 2n ** 80n + 42n,
          chainId: 42161n,
          receiver: TEST_USER,
          virtualProvider: zeroAddress,
          expressProvider: zeroAddress,
        },
      ],
      speedUp: false,
      providerData: "0x",
    },
  ];
  const routes = [
    { mode: "wallet", gasless: undefined, relayed: false },
    { mode: "gasless", gasless: undefined, relayed: true },
    { mode: "gasless", gasless: false, relayed: false },
    { mode: "wallet", gasless: true, relayed: true },
  ] as const;
  it.each(variants.flatMap((withdrawal) => routes.map((route) => ({ withdrawal, ...route }))))(
    "routes $withdrawal.method with mode=$mode / gasless=$gasless using one approval and the original VA",
    async ({ withdrawal, mode, gasless, relayed }) => {
      const { config, capability, provider, writeContract } = rig();
      const chain = config.getChainConfig();
      vi.spyOn(config, "getChainConfig").mockReturnValue({
        ...chain,
        contractsVersion: "0.8.6",
        gasless: { ...TEST_GASLESS, execution: { mode } },
      });
      const result = await earlyWithdraw(config, {
        account: VA,
        capability,
        provider,
        withdrawal,
        deadline: NOW + 300n,
        gasless,
      });
      expect(provider.requestApproval).toHaveBeenCalledOnce();
      expect(result.hash).toBe(relayed ? RELAY_HASH : TEST_TX_HASH);
      const decoded = decodeFunctionData({ abi: symmioAbi, data: result.callData });
      expect(decoded.functionName).toBe(withdrawal.method);
      const expectedArgs =
        withdrawal.method === "withdraw"
          ? [withdrawal.amount]
          : withdrawal.method === "withdrawTo"
            ? [withdrawal.recipient, withdrawal.amount]
            : [withdrawal.parts, false, "0x"];
      expect(decoded.args).toEqual(expectedArgs);
      const write = relayed
        ? decodeFunctionData({
            abi: accountLayerAbi,
            data: vi.mocked(submitGaslessWrite).mock.calls[0]![1].calls[0]!.callData,
          })
        : writeContract.mock.calls[0]![0];
      if (relayed) {
        expect(writeContract).not.toHaveBeenCalled();
        expect(submitGaslessWrite).toHaveBeenCalledExactlyOnceWith(config, expect.objectContaining({ account: ROOT }), {
          from: TEST_USER,
          startedAtMs: expect.any(Number),
        });
      } else {
        expect(submitGaslessWrite).not.toHaveBeenCalled();
        expect(writeContract).toHaveBeenCalledOnce();
        expect(write.account.address).toBe(TEST_USER);
      }
      expect(write.functionName).toBe("executeTimelockOp");
      expect(write.args[0][0].approval.account).toBe(ROOT);
      expect(decodeFunctionData({ abi: accountLayerAbi, data: write.args[1] })).toMatchObject({
        functionName: "_call",
        args: [VA, [result.callData]],
      });
    },
  );
  it.each([new Error("timeout"), new Error("rejected")])(
    "never sends a withdrawal after an approval error: %s",
    async (error) => {
      const { config, capability, provider, writeContract } = rig();
      provider.requestApproval.mockRejectedValue(error);
      await expect(
        earlyWithdraw(config, { account: VA, capability, provider, withdrawal: variants[0]!, deadline: NOW + 300n }),
      ).rejects.toBe(error);
      expect(provider.requestApproval).toHaveBeenCalledOnce();
      expect(writeContract).not.toHaveBeenCalled();
    },
  );
  it("stops mismatched unlockers before execution", async () => {
    const { config, capability, provider, writeContract } = rig();
    const original = provider.requestApproval.getMockImplementation()!;
    provider.requestApproval.mockImplementation(async (request) => ({
      ...(await original(request)),
      unlocker: TEST_USER,
    }));
    await expect(
      earlyWithdraw(config, { account: VA, capability, provider, withdrawal: variants[0]!, deadline: NOW + 300n }),
    ).rejects.toMatchObject({ code: "TIMELOCK_APPROVAL_RESPONSE_MISMATCH" });
    expect(writeContract).not.toHaveBeenCalled();
  });
  it("exposes the issued approval if the owner rejects execution", async () => {
    const { config, capability, provider, writeContract } = rig();
    writeContract.mockRejectedValue(new Error("wallet rejected"));
    await expect(
      earlyWithdraw(config, { account: VA, capability, provider, withdrawal: variants[0]!, deadline: NOW + 300n }),
    ).rejects.toMatchObject({
      approval: { signedApproval: { approval: { account: ROOT } } },
      cause: { message: "wallet rejected" },
    });
    expect(provider.requestApproval).toHaveBeenCalledOnce();
  });
  it("preserves the approval without submitting when persistence fails", async () => {
    const { config, capability, provider, writeContract } = rig();
    const onApproval = vi.fn().mockRejectedValue(new Error("storage unavailable"));
    await expect(
      earlyWithdraw(config, {
        account: VA,
        capability,
        provider,
        withdrawal: variants[0]!,
        deadline: NOW + 300n,
        onApproval,
      }),
    ).rejects.toMatchObject({
      approval: { signedApproval: { approval: { account: ROOT } } },
      cause: { message: "storage unavailable" },
    });
    expect(onApproval).toHaveBeenCalledOnce();
    expect(provider.requestApproval).toHaveBeenCalledOnce();
    expect(writeContract).not.toHaveBeenCalled();
  });
  it("rejects a wrong-chain owner before spending an approval slot", async () => {
    const { config, capability, provider, writeContract } = rig();
    const wallet = await config.getWalletClient();
    vi.spyOn(config, "getWalletClient").mockResolvedValue({ ...wallet, chain: { ...wallet.chain!, id: 1 } });
    await expect(
      earlyWithdraw(config, {
        account: VA,
        capability,
        provider,
        withdrawal: variants[0]!,
        deadline: NOW + 300n,
      }),
    ).rejects.toMatchObject({ code: "TIMELOCK_WALLET_CHAIN_MISMATCH" });
    expect(provider.requestApproval).not.toHaveBeenCalled();
    expect(writeContract).not.toHaveBeenCalled();
  });
});
