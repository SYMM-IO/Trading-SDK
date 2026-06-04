import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import {
  getSubAccountsCountOfUserQueryKey,
  getSubAccountsCountOfUserQueryOptions,
} from "./get-sub-accounts-count-of-user";

describe("getSubAccountsCountOfUserQueryOptions", () => {
  it("is disabled until `user` is set", () => {
    const { config } = mockConfig();
    expect(getSubAccountsCountOfUserQueryOptions(config, {}).enabled).toBe(false);
    expect(getSubAccountsCountOfUserQueryOptions(config, { user: TEST_USER }).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(
      getSubAccountsCountOfUserQueryOptions(config, { user: TEST_USER, query: { enabled: false } }).enabled,
    ).toBe(false);
  });

  it("queryFn delegates to the action", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(0n);

    await getSubAccountsCountOfUserQueryOptions(config, { user: TEST_USER }).queryFn();

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "getSubAccountsCountOfUser" }));
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getSubAccountsCountOfUserQueryOptions(config, { user: TEST_USER, chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key", () => {
    const key = getSubAccountsCountOfUserQueryKey({ chainId: SymmioSupportedChainId.HYPER_EVM, user: TEST_USER });
    expect(key).toEqual(["getSubAccountsCountOfUser", { chainId: SymmioSupportedChainId.HYPER_EVM, user: TEST_USER }]);
  });
});
