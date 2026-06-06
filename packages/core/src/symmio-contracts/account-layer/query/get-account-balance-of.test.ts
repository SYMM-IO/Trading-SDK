import type { Address, PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { createConfig } from "../../../core/config";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import { getAccountBalanceOfQueryKey, getAccountBalanceOfQueryOptions } from "./get-account-balance-of";

const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CUSTOM_SYMMIO: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("getAccountBalanceOfQueryOptions", () => {
  it("is disabled until `account` is set", () => {
    const { config } = mockConfig();
    expect(getAccountBalanceOfQueryOptions(config, {}).enabled).toBe(false);
    expect(getAccountBalanceOfQueryOptions(config, { account: ACCOUNT }).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(getAccountBalanceOfQueryOptions(config, { account: ACCOUNT, query: { enabled: false } }).enabled).toBe(
      false,
    );
  });

  it("queryFn delegates to the action", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(123n);

    await getAccountBalanceOfQueryOptions(config, { account: ACCOUNT }).queryFn();

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "balanceOf" }));
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getAccountBalanceOfQueryOptions(config, { account: ACCOUNT, chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key", () => {
    const key = getAccountBalanceOfQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      account: ACCOUNT,
    });
    expect(key).toEqual([
      "getAccountBalanceOf",
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

    const baseKey = getAccountBalanceOfQueryOptions(base, { account: ACCOUNT }).queryKey;
    const overriddenKey = getAccountBalanceOfQueryOptions(overridden, { account: ACCOUNT }).queryKey;

    expect((baseKey[1] as { configKey?: string }).configKey).toBe(base.getChainConfigKey());
    expect(overriddenKey).not.toEqual(baseKey);
  });
});
