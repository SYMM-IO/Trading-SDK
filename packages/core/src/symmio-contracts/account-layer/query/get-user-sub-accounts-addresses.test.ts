import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import {
  getUserSubAccountsAddressesQueryKey,
  getUserSubAccountsAddressesQueryOptions,
} from "./get-user-sub-accounts-addresses";

describe("getUserSubAccountsAddressesQueryOptions", () => {
  it("is disabled until `user` is set", () => {
    const { config } = mockConfig();
    expect(getUserSubAccountsAddressesQueryOptions(config, {}).enabled).toBe(false);
    expect(getUserSubAccountsAddressesQueryOptions(config, { user: TEST_USER }).enabled).toBe(true);
  });

  it("queryFn delegates to the action", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([]);

    await getUserSubAccountsAddressesQueryOptions(config, { user: TEST_USER }).queryFn();

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "getUserSubAccountsAddresses" }));
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getUserSubAccountsAddressesQueryOptions(config, { user: TEST_USER, chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable, bigint-safe key", () => {
    const key = getUserSubAccountsAddressesQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      user: TEST_USER,
      offset: 0n,
      limit: 200n,
    });
    expect(key).toEqual([
      "getUserSubAccountsAddresses",
      { chainId: SymmioSupportedChainId.HYPER_EVM, user: TEST_USER, offset: "0", limit: "200" },
    ]);
  });
});
