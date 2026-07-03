import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { getUserSubAccountsAddresses } from "./get-user-sub-accounts-addresses";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("getUserSubAccountsAddresses", () => {
  it("reads from the AccountLayer with default pagination", async () => {
    const { config, readContract } = mockConfig();

    await getUserSubAccountsAddresses(config, { user: TEST_USER });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "getUserSubAccountsAddresses",
        args: [TEST_USER, 0n, 200n],
      }),
    );
  });

  it("forwards offset and limit", async () => {
    const { config, readContract } = mockConfig();

    await getUserSubAccountsAddresses(config, { user: TEST_USER, offset: 5n, limit: 10n });

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ args: [TEST_USER, 5n, 10n] }));
  });
});
