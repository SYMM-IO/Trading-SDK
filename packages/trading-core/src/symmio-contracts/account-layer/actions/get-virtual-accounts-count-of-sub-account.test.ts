import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { getVirtualAccountsCountOfSubAccount } from "./get-virtual-accounts-count-of-sub-account";

const DEFAULT = getChainConfig(SymmioSupportedChainId.ARBITRUM);

describe("getVirtualAccountsCountOfSubAccount", () => {
  it("reads the count from the AccountLayer", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(3n);

    const count = await getVirtualAccountsCountOfSubAccount(config, { subAccount: TEST_USER });

    expect(count).toBe(3n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "getVirtualAccountsCountOfSubAccount",
        args: [TEST_USER],
      }),
    );
  });
});
