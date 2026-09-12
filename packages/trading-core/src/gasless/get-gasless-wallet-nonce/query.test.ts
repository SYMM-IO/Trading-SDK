import { describe, expect, it } from "vitest";
import { supportsGaslessService } from "../resolve-gasless";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";
import { getGaslessWalletNonceQueryKey, getGaslessWalletNonceQueryOptions } from "./query";

const ACCOUNT = "0x1111111111111111111111111111111111111111" as const;

describe("getGaslessWalletNonceQueryKey", () => {
  it("tags the key with the action name and drops undefined fields", () => {
    expect(getGaslessWalletNonceQueryKey({ chainId: undefined, account: ACCOUNT, configKey: "k" })).toEqual([
      "getGaslessWalletNonce",
      { account: ACCOUNT, configKey: "k" },
    ]);
  });

  it("accepts no options at all", () => {
    expect(getGaslessWalletNonceQueryKey()).toEqual(["getGaslessWalletNonce", {}]);
  });
});

describe("getGaslessWalletNonceQueryOptions", () => {
  it("keys the query by chain, account, and config", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessWalletNonceQueryOptions(config, { chainId: GASLESS_TEST_CHAIN, account: ACCOUNT });

    expect(options.enabled).toBe(true);
    expect(options.queryKey).toEqual([
      "getGaslessWalletNonce",
      { chainId: GASLESS_TEST_CHAIN, account: ACCOUNT, configKey: config.getChainConfigKey(GASLESS_TEST_CHAIN) },
    ]);
  });

  it("honours query.enabled", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessWalletNonceQueryOptions(config, { account: ACCOUNT, query: { enabled: false } });

    expect(options.enabled).toBe(false);
  });

  it("queryFn reads the forwarded account's wallet-operation nonce on the forwarded chain", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValue(4n);
    /** The config's default chain has no gasless block, so a dropped `chainId` would throw instead. */
    expect(supportsGaslessService(config)).toBe(false);

    const options = getGaslessWalletNonceQueryOptions(config, { chainId: GASLESS_TEST_CHAIN, account: ACCOUNT });

    await expect(options.queryFn()).resolves.toBe(4n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_GASLESS.gaslessLayerAddress,
        functionName: "walletOperationNonces",
        args: [ACCOUNT],
      }),
    );
  });
});
