import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { getUserSubAccountsQueryKey, getUserSubAccountsQueryOptions } from "./get-user-sub-accounts";

describe("getUserSubAccountsQueryOptions", () => {
  it("is disabled until `user` is set", () => {
    const { config } = mockConfig();
    expect(getUserSubAccountsQueryOptions(config, {}).enabled).toBe(false);
    expect(getUserSubAccountsQueryOptions(config, { user: TEST_USER }).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(getUserSubAccountsQueryOptions(config, { user: TEST_USER, query: { enabled: false } }).enabled).toBe(false);
  });

  it("queryFn delegates to the action", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([]);

    await getUserSubAccountsQueryOptions(config, { user: TEST_USER }).queryFn();

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "getUserSubAccounts" }));
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getUserSubAccountsQueryOptions(config, { user: TEST_USER, chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable, bigint-safe key", () => {
    const key = getUserSubAccountsQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      user: TEST_USER,
      offset: 0n,
      limit: 200n,
    });
    expect(key).toEqual([
      "getUserSubAccounts",
      { chainId: SymmioSupportedChainId.HYPER_EVM, user: TEST_USER, offset: "0", limit: "200" },
    ]);
  });
});
