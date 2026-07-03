import { encodeFunctionData, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { symmioAbi } from "../../abi/v0.8.5/symmio";
import { createClassicWithdrawPart } from "../parts";
import { initiateWithdraw } from "./initiate-withdraw";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RECEIVER: Address = "0xdddddddddddddddddddddddddddddddddddddddd";

const PARTS = [createClassicWithdrawPart({ id: 0n, amount: 1_000000n, receiver: RECEIVER, chainId: 999n })];

describe("initiateWithdraw", () => {
  it("wraps the core initiateWithdraw call in AccountLayer `_call`", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await initiateWithdraw(config, { account: SUB_ACCOUNT, parts: PARTS });

    const expectedData = encodeFunctionData({
      abi: symmioAbi,
      functionName: "initiateWithdraw",
      args: [PARTS, false, "0x"],
    });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "_call",
        args: [SUB_ACCOUNT, [expectedData]],
      }),
    );
  });

  it("forwards speedUp and providerData into the encoded core call", async () => {
    const { config, writeContract } = mockConfig();

    await initiateWithdraw(config, { account: SUB_ACCOUNT, parts: PARTS, speedUp: true, providerData: "0x1234" });

    const expectedData = encodeFunctionData({
      abi: symmioAbi,
      functionName: "initiateWithdraw",
      args: [PARTS, true, "0x1234"],
    });

    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "_call", args: [SUB_ACCOUNT, [expectedData]] }),
    );
  });

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(initiateWithdraw(config, { account: SUB_ACCOUNT, parts: PARTS })).rejects.toThrow(SymmError);
  });

  describe("pre-flight simulation", () => {
    it("dry-runs the routed `_call` before writing by default", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await initiateWithdraw(config, { account: SUB_ACCOUNT, parts: PARTS });

      const expectedData = encodeFunctionData({
        abi: symmioAbi,
        functionName: "initiateWithdraw",
        args: [PARTS, false, "0x"],
      });

      expect(simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "_call", args: [SUB_ACCOUNT, [expectedData]] }),
      );
      expect(simulateContract.mock.invocationCallOrder[0]!).toBeLessThan(writeContract.mock.invocationCallOrder[0]!);
    });

    it("skips the dry-run when `simulateBeforeWrite` is false on the call", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await initiateWithdraw(config, { account: SUB_ACCOUNT, parts: PARTS, simulateBeforeWrite: false });

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalled();
    });

    it("skips the dry-run when the config disables it globally", async () => {
      const { config, writeContract, simulateContract } = mockConfig({ simulateBeforeWrite: false });

      await initiateWithdraw(config, { account: SUB_ACCOUNT, parts: PARTS });

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalled();
    });

    it("aborts the write when the dry-run would revert", async () => {
      const { config, writeContract, simulateContract } = mockConfig();
      simulateContract.mockRejectedValueOnce(new Error("would revert"));

      await expect(initiateWithdraw(config, { account: SUB_ACCOUNT, parts: PARTS })).rejects.toThrow("would revert");
      expect(writeContract).not.toHaveBeenCalled();
    });
  });
});
