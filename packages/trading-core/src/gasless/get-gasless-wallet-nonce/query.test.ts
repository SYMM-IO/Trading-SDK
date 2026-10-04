import { describe, expect, it } from "vitest";
import { supportsGaslessService } from "../resolve-gasless";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";
import { getGaslessWalletNonceQueryKey, getGaslessWalletNonceQueryOptions } from "./query";

const OWNER = "0x2222222222222222222222222222222222222222" as const;
const ACCOUNT = "0x1111111111111111111111111111111111111111" as const;

describe("getGaslessWalletNonceQueryKey", () => {
  it("tags the key with the action name and drops undefined fields", () => {
    expect(getGaslessWalletNonceQueryKey({ chainId: undefined, account: ACCOUNT, configKey: "k" })).toEqual([
      "getGaslessWalletNonce",
      { account: ACCOUNT, walletId: "0", configKey: "k" },
    ]);
  });

  it("keys an omitted wallet id as wallet 0", () => {
    expect(getGaslessWalletNonceQueryKey({ owner: OWNER, account: ACCOUNT })).toEqual(
      getGaslessWalletNonceQueryKey({ owner: OWNER, walletId: 0n, account: ACCOUNT }),
    );
    expect(getGaslessWalletNonceQueryKey({ owner: OWNER, account: ACCOUNT })).not.toEqual(
      getGaslessWalletNonceQueryKey({ owner: OWNER, walletId: 1n, account: ACCOUNT }),
    );
  });

  it("accepts no options at all", () => {
    expect(getGaslessWalletNonceQueryKey()).toEqual(["getGaslessWalletNonce", { walletId: "0" }]);
  });
});

describe("getGaslessWalletNonceQueryOptions", () => {
  it("keys the query by chain, owner, wallet id, account, and config", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessWalletNonceQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      walletId: 5n,
      account: ACCOUNT,
    });

    expect(options.enabled).toBe(true);
    expect(options.queryKey).toEqual([
      "getGaslessWalletNonce",
      {
        chainId: GASLESS_TEST_CHAIN,
        owner: OWNER,
        walletId: "5",
        account: ACCOUNT,
        configKey: config.getChainConfigKey(GASLESS_TEST_CHAIN),
      },
    ]);
  });

  it("shares one cache entry between an omitted wallet id and 0n", () => {
    const { config } = gaslessTestConfig();

    const omitted = getGaslessWalletNonceQueryOptions(config, { owner: OWNER, account: ACCOUNT });
    const zero = getGaslessWalletNonceQueryOptions(config, { owner: OWNER, walletId: 0n, account: ACCOUNT });

    expect(omitted.queryKey).toEqual(zero.queryKey);
  });

  it("honours query.enabled", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessWalletNonceQueryOptions(config, {
      owner: OWNER,
      account: ACCOUNT,
      query: { enabled: false },
    });

    expect(options.enabled).toBe(false);
    expect(options.queryKey[1]).not.toHaveProperty("query");
  });

  it("queryFn reads the forwarded account's wallet-operation nonce on the forwarded chain", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValue(4n);
    /** The config's default chain has no gasless block, so a dropped `chainId` would throw instead. */
    expect(supportsGaslessService(config)).toBe(false);

    const options = getGaslessWalletNonceQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      account: ACCOUNT,
    });

    await expect(options.queryFn()).resolves.toBe(4n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_GASLESS.gaslessLayerAddress,
        functionName: "walletOperationNonces",
        args: [OWNER, 0n, ACCOUNT],
      }),
    );
  });

  it("queryFn forwards the wallet id — a dropped one would silently read wallet 0's stream", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValue(9n);

    const options = getGaslessWalletNonceQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      walletId: 3n,
      account: ACCOUNT,
    });
    await options.queryFn();

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "walletOperationNonces", args: [OWNER, 3n, ACCOUNT] }),
    );
  });
});
