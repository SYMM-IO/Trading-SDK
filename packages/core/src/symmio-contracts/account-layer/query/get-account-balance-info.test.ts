import type { Address, PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import { getAccountBalanceInfoQueryKey, getAccountBalanceInfoQueryOptions } from "./get-account-balance-info";

const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CUSTOM_SYMMIO: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("getAccountBalanceInfoQueryOptions", () => {
  it("is disabled until `account` is set", () => {
    const { config } = mockConfig();
    expect(getAccountBalanceInfoQueryOptions(config, {}).enabled).toBe(false);
    expect(getAccountBalanceInfoQueryOptions(config, { account: ACCOUNT }).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(getAccountBalanceInfoQueryOptions(config, { account: ACCOUNT, query: { enabled: false } }).enabled).toBe(
      false,
    );
  });

  it("queryFn delegates to the action", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n]);

    await getAccountBalanceInfoQueryOptions(config, { account: ACCOUNT }).queryFn();

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "balanceInfoOfPartyA" }));
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getAccountBalanceInfoQueryOptions(config, { account: ACCOUNT, chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key", () => {
    const key = getAccountBalanceInfoQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      account: ACCOUNT,
    });
    expect(key).toEqual([
      "getAccountBalanceInfo",
      {
        chainId: SymmioSupportedChainId.HYPER_EVM,
        account: ACCOUNT,
      },
    ]);
  });

  it("folds the chain config fingerprint into the factory key so overrides rekey", () => {
    const { config: base } = mockConfig();
    const overridden = createConfig({
      getClient: () => ({}) as PublicClient,
      chainOverrides: {
        [SymmioSupportedChainId.HYPER_EVM]: {
          addresses: { symmioAddress: CUSTOM_SYMMIO },
        },
      },
    });

    const baseKey = getAccountBalanceInfoQueryOptions(base, { account: ACCOUNT }).queryKey;
    const overriddenKey = getAccountBalanceInfoQueryOptions(overridden, { account: ACCOUNT }).queryKey;

    expect((baseKey[1] as { configKey?: string }).configKey).toBe(base.getChainConfigKey());
    expect(overriddenKey).not.toEqual(baseKey);
  });
});
