import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { editAccountName } from "./edit-account-name";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("editAccountName", () => {
  it("writes editAccountName to the AccountLayer", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await editAccountName(config, { account: SUB_ACCOUNT, name: "Main" });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "editAccountName",
        args: [SUB_ACCOUNT, "Main"],
      }),
    );
  });

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(editAccountName(config, { account: SUB_ACCOUNT, name: "Main" })).rejects.toThrow(SymmError);
  });

  describe("pre-flight simulation", () => {
    it("dry-runs the call before writing by default", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await editAccountName(config, { account: SUB_ACCOUNT, name: "Main" });

      expect(simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "editAccountName", args: [SUB_ACCOUNT, "Main"] }),
      );
      expect(simulateContract.mock.invocationCallOrder[0]!).toBeLessThan(writeContract.mock.invocationCallOrder[0]!);
    });

    it("skips the dry-run when `simulateBeforeWrite` is false on the call", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await editAccountName(config, { account: SUB_ACCOUNT, name: "Main", simulateBeforeWrite: false });

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalled();
    });

    it("skips the dry-run when the config disables it globally", async () => {
      const { config, writeContract, simulateContract } = mockConfig({ simulateBeforeWrite: false });

      await editAccountName(config, { account: SUB_ACCOUNT, name: "Main" });

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalled();
    });

    it("aborts the write when the dry-run would revert", async () => {
      const { config, writeContract, simulateContract } = mockConfig();
      simulateContract.mockRejectedValueOnce(new Error("would revert"));

      await expect(editAccountName(config, { account: SUB_ACCOUNT, name: "Main" })).rejects.toThrow("would revert");
      expect(writeContract).not.toHaveBeenCalled();
    });
  });
});
