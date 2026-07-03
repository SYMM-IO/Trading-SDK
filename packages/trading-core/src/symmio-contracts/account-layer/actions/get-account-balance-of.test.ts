import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig } from "../../../shared/test/mock-config";
import { getAccountBalanceOf } from "./get-account-balance-of";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("getAccountBalanceOf", () => {
  it("reads balanceOf from the configured SYMMIO core", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(123n);

    const result = await getAccountBalanceOf(config, { account: ACCOUNT });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "balanceOf",
        args: [ACCOUNT],
      }),
    );
    expect(result).toBe(123n);
  });
});
