import { encodeFunctionData, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { symmioAbi } from "../../abi/v0.8.6/symmio";
import { allocate } from "./allocate";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const AMOUNT = 1_000000000000000000n;

describe("allocate", () => {
  it("wraps the core allocate call in AccountLayer `_call`", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await allocate(config, { account: SUB_ACCOUNT, amount: AMOUNT });

    const expectedData = encodeFunctionData({
      abi: symmioAbi,
      functionName: "allocate",
      args: [AMOUNT],
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

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(allocate(config, { account: SUB_ACCOUNT, amount: AMOUNT })).rejects.toThrow(SymmError);
  });

  describe("pre-flight simulation", () => {
    it("dry-runs the routed `_call` before writing by default", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await allocate(config, { account: SUB_ACCOUNT, amount: AMOUNT });

      const expectedData = encodeFunctionData({
        abi: symmioAbi,
        functionName: "allocate",
        args: [AMOUNT],
      });

      expect(simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "_call", args: [SUB_ACCOUNT, [expectedData]] }),
      );
      expect(simulateContract.mock.invocationCallOrder[0]!).toBeLessThan(writeContract.mock.invocationCallOrder[0]!);
    });

    it("skips the dry-run when `simulateBeforeWrite` is false on the call", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await allocate(config, { account: SUB_ACCOUNT, amount: AMOUNT, simulateBeforeWrite: false });

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalled();
    });

    it("skips the dry-run when the config disables it globally", async () => {
      const { config, writeContract, simulateContract } = mockConfig({ simulateBeforeWrite: false });

      await allocate(config, { account: SUB_ACCOUNT, amount: AMOUNT });

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalled();
    });

    it("aborts the write when the dry-run would revert", async () => {
      const { config, writeContract, simulateContract } = mockConfig();
      simulateContract.mockRejectedValueOnce(new Error("would revert"));

      await expect(allocate(config, { account: SUB_ACCOUNT, amount: AMOUNT })).rejects.toThrow("would revert");
      expect(writeContract).not.toHaveBeenCalled();
    });
  });
});
