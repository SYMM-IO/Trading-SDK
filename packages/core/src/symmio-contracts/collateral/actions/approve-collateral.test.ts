import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_TX_HASH } from "../../../shared/test/mock-config";
import { approveCollateral } from "./approve-collateral";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const AMOUNT = 5_000000n;

describe("approveCollateral", () => {
  it("approves the collateral token for the SYMMIO core", async () => {
    const { config, writeContract } = mockConfig();

    const hash = await approveCollateral(config, { amount: AMOUNT });

    expect(hash).toBe(TEST_TX_HASH);
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.collateralAddress,
        functionName: "approve",
        args: [DEFAULT.addresses.symmioAddress, AMOUNT],
      }),
    );
  });

  it("throws when the config has no wallet resolver", async () => {
    const { config } = mockConfig({ withWallet: false });

    await expect(approveCollateral(config, { amount: AMOUNT })).rejects.toThrow(SymmError);
  });

  describe("pre-flight simulation", () => {
    it("dry-runs the call before writing by default", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await approveCollateral(config, { amount: AMOUNT });

      expect(simulateContract).toHaveBeenCalledWith(
        expect.objectContaining({ functionName: "approve", args: [DEFAULT.addresses.symmioAddress, AMOUNT] }),
      );
      expect(simulateContract.mock.invocationCallOrder[0]!).toBeLessThan(writeContract.mock.invocationCallOrder[0]!);
    });

    it("skips the dry-run when `simulateBeforeWrite` is false on the call", async () => {
      const { config, writeContract, simulateContract } = mockConfig();

      await approveCollateral(config, { amount: AMOUNT, simulateBeforeWrite: false });

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalled();
    });

    it("skips the dry-run when the config disables it globally", async () => {
      const { config, writeContract, simulateContract } = mockConfig({ simulateBeforeWrite: false });

      await approveCollateral(config, { amount: AMOUNT });

      expect(simulateContract).not.toHaveBeenCalled();
      expect(writeContract).toHaveBeenCalled();
    });

    it("aborts the write when the dry-run would revert", async () => {
      const { config, writeContract, simulateContract } = mockConfig();
      simulateContract.mockRejectedValueOnce(new Error("would revert"));

      await expect(approveCollateral(config, { amount: AMOUNT })).rejects.toThrow("would revert");
      expect(writeContract).not.toHaveBeenCalled();
    });
  });
});
