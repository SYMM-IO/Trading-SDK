import type { Address } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import { getSubAccountQueryKey, getSubAccountQueryOptions } from "./get-sub-account";

const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("getSubAccountQueryOptions", () => {
  it("is disabled until `account` is set", () => {
    const { config } = mockConfig();
    expect(getSubAccountQueryOptions(config, {}).enabled).toBe(false);
    expect(getSubAccountQueryOptions(config, { account: SUB_ACCOUNT }).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(getSubAccountQueryOptions(config, { account: SUB_ACCOUNT, query: { enabled: false } }).enabled).toBe(false);
  });

  it("queryFn delegates to the action", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([]);

    await getSubAccountQueryOptions(config, { account: SUB_ACCOUNT }).queryFn();

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "getSubAccount" }));
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getSubAccountQueryOptions(config, { account: SUB_ACCOUNT, chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key", () => {
    const key = getSubAccountQueryKey({ chainId: SymmioSupportedChainId.HYPER_EVM, account: SUB_ACCOUNT });
    expect(key).toEqual(["getSubAccount", { chainId: SymmioSupportedChainId.HYPER_EVM, account: SUB_ACCOUNT }]);
  });
});
