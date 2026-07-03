import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { getVirtualAccountsAddressesOfSubAccount } from "./get-virtual-accounts-addresses-of-sub-account";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("getVirtualAccountsAddressesOfSubAccount", () => {
  it("reads from the AccountLayer with default pagination", async () => {
    const { config, readContract } = mockConfig();

    await getVirtualAccountsAddressesOfSubAccount(config, { subAccount: TEST_USER });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "getVirtualAccountsAddressesOfSubAccount",
        args: [TEST_USER, 0n, 200n],
      }),
    );
  });

  it("forwards offset and limit", async () => {
    const { config, readContract } = mockConfig();

    await getVirtualAccountsAddressesOfSubAccount(config, { subAccount: TEST_USER, offset: 5n, limit: 10n });

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ args: [TEST_USER, 5n, 10n] }));
  });
});
