import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { getChainConfig, SymmioSupportedChainId } from "../../../core/chains";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { VIRTUAL_ACCOUNT_ISOLATION_TYPE } from "../../../solvers/instant-open/shared/types";
import { getVirtualAccountsOfSubAccount } from "./get-virtual-accounts-of-sub-account";

const DEFAULT = getChainConfig(SymmioSupportedChainId.ARBITRUM);
const VA: Address = "0x2222222222222222222222222222222222222222";

describe("getVirtualAccountsOfSubAccount", () => {
  it("reads the details from the AccountLayer with default pagination", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([
      {
        accountAddress: VA,
        parentAccount: TEST_USER,
        symbolId: 42n,
        isExists: true,
        metadata: "0x",
        isolationType: VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_LONG,
      },
    ]);

    const vas = await getVirtualAccountsOfSubAccount(config, { subAccount: TEST_USER });

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "getVirtualAccountsOfSubAccount",
        args: [TEST_USER, 0n, 200n],
      }),
    );
    expect(vas).toEqual([
      {
        accountAddress: VA,
        parentAccount: TEST_USER,
        symbolId: 42n,
        isExists: true,
        metadata: "0x",
        isolationType: VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_LONG,
      },
    ]);
  });

  it("forwards offset and limit", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([]);

    await getVirtualAccountsOfSubAccount(config, { subAccount: TEST_USER, offset: 5n, limit: 10n });

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ args: [TEST_USER, 5n, 10n] }));
  });
});
