import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import {
  getVirtualAccountsAddressesOfSubAccountQueryKey,
  getVirtualAccountsAddressesOfSubAccountQueryOptions,
} from "./get-virtual-accounts-addresses-of-sub-account";

describe("getVirtualAccountsAddressesOfSubAccountQueryOptions", () => {
  it("is disabled until `subAccount` is set", () => {
    const { config } = mockConfig();
    expect(getVirtualAccountsAddressesOfSubAccountQueryOptions(config, {}).enabled).toBe(false);
    expect(getVirtualAccountsAddressesOfSubAccountQueryOptions(config, { subAccount: TEST_USER }).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(
      getVirtualAccountsAddressesOfSubAccountQueryOptions(config, {
        subAccount: TEST_USER,
        query: { enabled: false },
      }).enabled,
    ).toBe(false);
  });

  it("queryFn delegates to the action", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([]);

    await getVirtualAccountsAddressesOfSubAccountQueryOptions(config, { subAccount: TEST_USER }).queryFn();

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getVirtualAccountsAddressesOfSubAccount" }),
    );
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getVirtualAccountsAddressesOfSubAccountQueryOptions(config, {
      subAccount: TEST_USER,
      chainId: mainnet.id,
    });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable, bigint-safe key", () => {
    const key = getVirtualAccountsAddressesOfSubAccountQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      subAccount: TEST_USER,
      offset: 0n,
      limit: 200n,
    });
    expect(key).toEqual([
      "getVirtualAccountsAddressesOfSubAccount",
      { chainId: SymmioSupportedChainId.HYPER_EVM, subAccount: TEST_USER, offset: "0", limit: "200" },
    ]);
  });
});
