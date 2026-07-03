import type { Address, Hex } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import { getIsDelegationActiveQueryKey, getIsDelegationActiveQueryOptions } from "./get-is-delegation-active";

const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DELEGATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SELECTOR: Hex = "0x12345678";

describe("getIsDelegationActiveQueryOptions", () => {
  it("is enabled by default when read inputs are passed", () => {
    const { config } = mockConfig();

    expect(
      getIsDelegationActiveQueryOptions(config, { account: ACCOUNT, delegate: DELEGATE, selector: SELECTOR }).enabled,
    ).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();

    expect(
      getIsDelegationActiveQueryOptions(config, {
        account: ACCOUNT,
        delegate: DELEGATE,
        selector: SELECTOR,
        query: { enabled: false },
      }).enabled,
    ).toBe(false);
  });

  it("queryFn delegates to the action", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(true);

    await getIsDelegationActiveQueryOptions(config, {
      account: ACCOUNT,
      delegate: DELEGATE,
      selector: SELECTOR,
    }).queryFn();

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "isDelegationActive" }));
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getIsDelegationActiveQueryOptions(config, {
      account: ACCOUNT,
      delegate: DELEGATE,
      selector: SELECTOR,
      chainId: mainnet.id,
    });

    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key", () => {
    const key = getIsDelegationActiveQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      account: ACCOUNT,
      delegate: DELEGATE,
      selector: SELECTOR,
    });

    expect(key).toEqual([
      "getIsDelegationActive",
      { chainId: SymmioSupportedChainId.HYPER_EVM, account: ACCOUNT, delegate: DELEGATE, selector: SELECTOR },
    ]);
  });
});
