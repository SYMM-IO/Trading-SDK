import type { Address, Hex, PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import { getDelegationExpiryQueryKey, getDelegationExpiryQueryOptions } from "./get-delegation-expiry";

const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const DELEGATE: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SELECTOR: Hex = "0x12345678";

describe("getDelegationExpiryQueryOptions", () => {
  it("is enabled by default when read inputs are passed", () => {
    const { config } = mockConfig();

    expect(
      getDelegationExpiryQueryOptions(config, { account: ACCOUNT, delegate: DELEGATE, selector: SELECTOR }).enabled,
    ).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();

    expect(
      getDelegationExpiryQueryOptions(config, {
        account: ACCOUNT,
        delegate: DELEGATE,
        selector: SELECTOR,
        query: { enabled: false },
      }).enabled,
    ).toBe(false);
  });

  it("queryFn delegates to the action", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(123n);

    await getDelegationExpiryQueryOptions(config, {
      account: ACCOUNT,
      delegate: DELEGATE,
      selector: SELECTOR,
    }).queryFn();

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "delegations" }));
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getDelegationExpiryQueryOptions(config, {
      account: ACCOUNT,
      delegate: DELEGATE,
      selector: SELECTOR,
      chainId: mainnet.id,
    });

    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key", () => {
    const key = getDelegationExpiryQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      account: ACCOUNT,
      delegate: DELEGATE,
      selector: SELECTOR,
    });

    expect(key).toEqual([
      "getDelegationExpiry",
      { chainId: SymmioSupportedChainId.HYPER_EVM, account: ACCOUNT, delegate: DELEGATE, selector: SELECTOR },
    ]);
  });

  it("folds the chain config fingerprint into the factory key so overrides rekey", () => {
    const { config: base } = mockConfig();
    const overridden = createConfig({
      getClient: () => ({}) as PublicClient,
      symmioConfig: {
        [SymmioSupportedChainId.HYPER_EVM]: {
          addresses: {
            affiliatesAddress: "0x000000000000000000000000000000000000aFF1",
            instantLayerAddress: "0x9999999999999999999999999999999999999999",
          },
        },
      },
    });

    const baseKey = getDelegationExpiryQueryOptions(base, {
      account: ACCOUNT,
      delegate: DELEGATE,
      selector: SELECTOR,
    }).queryKey;
    const overriddenKey = getDelegationExpiryQueryOptions(overridden, {
      account: ACCOUNT,
      delegate: DELEGATE,
      selector: SELECTOR,
    }).queryKey;

    expect((baseKey[1] as { configKey?: string }).configKey).toBe(base.getChainConfigKey());
    expect(overriddenKey).not.toEqual(baseKey);
  });
});
