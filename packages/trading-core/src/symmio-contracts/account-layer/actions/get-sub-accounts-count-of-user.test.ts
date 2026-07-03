import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { getSubAccountsCountOfUser } from "./get-sub-accounts-count-of-user";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);

describe("getSubAccountsCountOfUser", () => {
  it("reads getSubAccountsCountOfUser from the AccountLayer", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(3n);

    const count = await getSubAccountsCountOfUser(config, { user: TEST_USER });

    expect(count).toBe(3n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "getSubAccountsCountOfUser",
        args: [TEST_USER],
      }),
    );
  });
});
