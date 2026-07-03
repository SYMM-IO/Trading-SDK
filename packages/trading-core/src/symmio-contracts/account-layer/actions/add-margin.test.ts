import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { addMargin } from "./add-margin";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const VIRTUAL_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const AMOUNT = 50_000000000000000000n;

describe("addMargin", () => {
  it("writes addMargin to the AccountLayer", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await addMargin(config, { virtualAccount: VIRTUAL_ACCOUNT, amount: AMOUNT });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "addMargin",
        args: [VIRTUAL_ACCOUNT, AMOUNT],
      }),
    );
  });

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(addMargin(config, { virtualAccount: VIRTUAL_ACCOUNT, amount: AMOUNT })).rejects.toThrow(SymmError);
  });

  describe("pre-flight simulation", () => {
    it("dry-runs the call before writing by default", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await addMargin(config, { virtualAccount: VIRTUAL_ACCOUNT, amount: AMOUNT });

      expect(simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "addMargin", args: [VIRTUAL_ACCOUNT, AMOUNT] }),
      );
      expect(simulateContract.mock.invocationCallOrder[0]!).toBeLessThan(writeContract.mock.invocationCallOrder[0]!);
    });

    it("skips the dry-run when `simulateBeforeWrite` is false on the call", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await addMargin(config, { virtualAccount: VIRTUAL_ACCOUNT, amount: AMOUNT, simulateBeforeWrite: false });

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalled();
    });

    it("skips the dry-run when the config disables it globally", async () => {
      const { config, writeContract, simulateContract } = mockConfig({ simulateBeforeWrite: false });

      await addMargin(config, { virtualAccount: VIRTUAL_ACCOUNT, amount: AMOUNT });

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalled();
    });

    it("aborts the write when the dry-run would revert", async () => {
      const { config, writeContract, simulateContract } = mockConfig();
      simulateContract.mockRejectedValueOnce(new Error("would revert"));

      await expect(addMargin(config, { virtualAccount: VIRTUAL_ACCOUNT, amount: AMOUNT })).rejects.toThrow(
        "would revert",
      );
      expect(writeContract).not.toHaveBeenCalled();
    });
  });
});
