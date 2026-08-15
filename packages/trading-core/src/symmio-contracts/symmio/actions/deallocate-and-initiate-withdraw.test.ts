import { encodeFunctionData, type Address } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import type { SingleUpnlSig } from "../../account-layer/types";
import { createClassicWithdrawPart } from "../parts";
import { deallocateAndInitiateWithdraw } from "./deallocate-and-initiate-withdraw";

const getDeallocateUpnlSig = vi.hoisted(() => vi.fn());

vi.mock("../../../muon/deallocate-upnl-sig/get-deallocate-upnl-sig", () => ({ getDeallocateUpnlSig }));

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RECEIVER: Address = "0xdddddddddddddddddddddddddddddddddddddddd";
const AMOUNT = 1_000000000000000000n;
const PARTS = [createClassicWithdrawPart({ id: 0n, amount: 1_000000n, receiver: RECEIVER, chainId: 999n })];
const UPNL_SIG: SingleUpnlSig = {
  reqId: "0x1234",
  timestamp: 1_700_000_000n,
  upnl: -25_000000000000000000n,
  gatewaySignature: "0xabcd",
  sigs: {
    signature: 99n,
    owner: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    nonce: "0xcccccccccccccccccccccccccccccccccccccccc",
  },
};

const EXPECTED_DEALLOCATE = encodeFunctionData({
  abi: symmioAbi,
  functionName: "deallocate",
  args: [AMOUNT, UPNL_SIG],
});
const EXPECTED_WITHDRAW = encodeFunctionData({
  abi: symmioAbi,
  functionName: "initiateWithdraw",
  args: [PARTS, false, "0x"],
});

describe("deallocateAndInitiateWithdraw", () => {
  afterEach(() => {
    getDeallocateUpnlSig.mockReset();
  });

  it("batches deallocate + initiateWithdraw (deallocate first) into one AccountLayer `_call`", async () => {
    const { config, writeContract } = mockConfig();
    getDeallocateUpnlSig.mockResolvedValueOnce(UPNL_SIG);

    const hash = await deallocateAndInitiateWithdraw(config, { account: SUB_ACCOUNT, amount: AMOUNT, parts: PARTS });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "_call",
        args: [SUB_ACCOUNT, [EXPECTED_DEALLOCATE, EXPECTED_WITHDRAW]],
      }),
    );
  });

  it("fetches a fresh uPnL signature for the deallocate leg when none is supplied", async () => {
    const { config } = mockConfig();
    getDeallocateUpnlSig.mockResolvedValueOnce(UPNL_SIG);

    await deallocateAndInitiateWithdraw(config, { account: SUB_ACCOUNT, amount: AMOUNT, parts: PARTS });

    expect(getDeallocateUpnlSig).toHaveBeenCalledWith(config, expect.objectContaining({ virtualAccount: SUB_ACCOUNT }));
  });

  it("uses a supplied upnlSig without fetching one", async () => {
    const { config, writeContract } = mockConfig();

    await deallocateAndInitiateWithdraw(config, {
      account: SUB_ACCOUNT,
      amount: AMOUNT,
      parts: PARTS,
      upnlSig: UPNL_SIG,
    });

    expect(getDeallocateUpnlSig).not.toHaveBeenCalled();
    expect(writeContract.mock.calls[0]![0].args).toEqual([SUB_ACCOUNT, [EXPECTED_DEALLOCATE, EXPECTED_WITHDRAW]]);
  });

  it("forwards speedUp and providerData into the encoded withdraw leg", async () => {
    const { config, writeContract } = mockConfig();

    await deallocateAndInitiateWithdraw(config, {
      account: SUB_ACCOUNT,
      amount: AMOUNT,
      parts: PARTS,
      speedUp: true,
      providerData: "0x1234",
      upnlSig: UPNL_SIG,
    });

    const expectedWithdraw = encodeFunctionData({
      abi: symmioAbi,
      functionName: "initiateWithdraw",
      args: [PARTS, true, "0x1234"],
    });

    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "_call", args: [SUB_ACCOUNT, [EXPECTED_DEALLOCATE, expectedWithdraw]] }),
    );
  });

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(
      deallocateAndInitiateWithdraw(config, { account: SUB_ACCOUNT, amount: AMOUNT, parts: PARTS, upnlSig: UPNL_SIG }),
    ).rejects.toThrow(SymmError);
  });

  describe("pre-flight simulation", () => {
    it("dry-runs the batched `_call` before writing by default", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await deallocateAndInitiateWithdraw(config, {
        account: SUB_ACCOUNT,
        amount: AMOUNT,
        parts: PARTS,
        upnlSig: UPNL_SIG,
      });

      expect(simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({
          functionName: "_call",
          args: [SUB_ACCOUNT, [EXPECTED_DEALLOCATE, EXPECTED_WITHDRAW]],
        }),
      );
      expect(simulateContract.mock.invocationCallOrder[0]!).toBeLessThan(writeContract.mock.invocationCallOrder[0]!);
    });

    it("aborts the write when the dry-run would revert", async () => {
      const { config, writeContract, simulateContract } = mockConfig();
      simulateContract.mockRejectedValueOnce(new Error("would revert"));

      await expect(
        deallocateAndInitiateWithdraw(config, {
          account: SUB_ACCOUNT,
          amount: AMOUNT,
          parts: PARTS,
          upnlSig: UPNL_SIG,
        }),
      ).rejects.toThrow("would revert");
      expect(writeContract).not.toHaveBeenCalled();
    });
  });
});
