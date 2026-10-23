import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { getWithdrawCooldownOf } from "./get-withdraw-cooldown-of";

describe("getWithdrawCooldownOf", () => {
  it.each([0n, 1_800_000_000n, 2n ** 80n])("preserves the raw bigint %s and configured target", async (value) => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValue(value);
    expect(await getWithdrawCooldownOf(config, { user: TEST_USER, chainId: SymmioSupportedChainId.BASE })).toBe(value);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getChainConfig(SymmioSupportedChainId.BASE).addresses.symmioAddress,
        functionName: "withdrawCooldownOf",
        args: [TEST_USER],
      }),
    );
  });

  it("propagates an RPC failure without treating it as zero", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockRejectedValue(new Error("unavailable"));
    await expect(getWithdrawCooldownOf(config, { user: TEST_USER })).rejects.toThrow("unavailable");
  });

  it("throws a SymmError for an unsupported chain", async () => {
    const { config, readContract } = mockConfig();
    await expect(getWithdrawCooldownOf(config, { user: TEST_USER, chainId: mainnet.id })).rejects.toThrow(SymmError);
    expect(readContract).not.toHaveBeenCalled();
  });
});
