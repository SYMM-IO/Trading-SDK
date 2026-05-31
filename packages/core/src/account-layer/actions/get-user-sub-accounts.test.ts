import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../chains";
import { mockConfig, TEST_USER } from "../../test/mock-config";
import { getUserSubAccounts } from "./get-user-sub-accounts";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("getUserSubAccounts", () => {
  it("reads from the AccountLayer with default pagination", async () => {
    const { config, readContract } = mockConfig();

    await getUserSubAccounts(config, { user: TEST_USER });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "getUserSubAccounts",
        args: [TEST_USER, 0n, 200n],
      }),
    );
  });

  it("forwards offset and limit", async () => {
    const { config, readContract } = mockConfig();

    await getUserSubAccounts(config, { user: TEST_USER, offset: 5n, limit: 10n });

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ args: [TEST_USER, 5n, 10n] }));
  });
});
