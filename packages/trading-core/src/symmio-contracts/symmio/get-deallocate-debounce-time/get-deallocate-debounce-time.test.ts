import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import { getDeallocateDebounceTime } from "./get-deallocate-debounce-time";

describe("getDeallocateDebounceTime", () => {
  it.each([0n, 1_800_000_000n, 2n ** 80n])("preserves the raw bigint %s and configured target", async (value) => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValue(value);
    expect(await getDeallocateDebounceTime(config, { chainId: SymmioSupportedChainId.BASE })).toBe(value);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: getChainConfig(SymmioSupportedChainId.BASE).addresses.symmioAddress,
        functionName: "getDeallocateDebounceTime",
      }),
    );
  });

  it("propagates an RPC failure without treating it as zero", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockRejectedValue(new Error("unavailable"));
    await expect(getDeallocateDebounceTime(config)).rejects.toThrow("unavailable");
  });

  it("throws a SymmError for an unsupported chain", async () => {
    const { config, readContract } = mockConfig();
    await expect(getDeallocateDebounceTime(config, { chainId: mainnet.id })).rejects.toThrow(SymmError);
    expect(readContract).not.toHaveBeenCalled();
  });
});
