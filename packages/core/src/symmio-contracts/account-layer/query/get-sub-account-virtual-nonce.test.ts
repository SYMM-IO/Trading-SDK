import type { Address } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import {
  getSubAccountVirtualNonceQueryKey,
  getSubAccountVirtualNonceQueryOptions,
} from "./get-sub-account-virtual-nonce";

const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("getSubAccountVirtualNonceQueryOptions", () => {
  it("is disabled until `subAccount` is set", () => {
    const { config } = mockConfig();
    expect(getSubAccountVirtualNonceQueryOptions(config, {}).enabled).toBe(false);
    expect(getSubAccountVirtualNonceQueryOptions(config, { subAccount: SUB_ACCOUNT }).enabled).toBe(true);
  });

  it("queryFn delegates to the action", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(0n);

    await getSubAccountVirtualNonceQueryOptions(config, { subAccount: SUB_ACCOUNT }).queryFn();

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "getSubAccountVirtualNonce" }));
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getSubAccountVirtualNonceQueryOptions(config, { subAccount: SUB_ACCOUNT, chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key", () => {
    const key = getSubAccountVirtualNonceQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      subAccount: SUB_ACCOUNT,
    });
    expect(key).toEqual([
      "getSubAccountVirtualNonce",
      { chainId: SymmioSupportedChainId.HYPER_EVM, subAccount: SUB_ACCOUNT },
    ]);
  });
});
