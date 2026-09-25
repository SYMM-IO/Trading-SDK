import { describe, expect, it } from "vitest";
import { supportsGaslessService } from "../resolve-gasless";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";
import { getGaslessWalletCreationFeeQueryKey, getGaslessWalletCreationFeeQueryOptions } from "./query";

const OWNER = "0x1111111111111111111111111111111111111111" as const;

describe("getGaslessWalletCreationFeeQueryKey", () => {
  it("tags the key with the action name and drops undefined fields", () => {
    expect(getGaslessWalletCreationFeeQueryKey({ chainId: undefined, owner: OWNER, configKey: "k" })).toEqual([
      "getGaslessWalletCreationFee",
      { owner: OWNER, walletId: "0", configKey: "k" },
    ]);
  });

  it("keys an omitted wallet id as wallet 0", () => {
    expect(getGaslessWalletCreationFeeQueryKey({ owner: OWNER })).toEqual(
      getGaslessWalletCreationFeeQueryKey({ owner: OWNER, walletId: 0n }),
    );
    expect(getGaslessWalletCreationFeeQueryKey({ owner: OWNER })).not.toEqual(
      getGaslessWalletCreationFeeQueryKey({ owner: OWNER, walletId: 1n }),
    );
  });

  it("accepts no options at all", () => {
    expect(getGaslessWalletCreationFeeQueryKey()).toEqual(["getGaslessWalletCreationFee", { walletId: "0" }]);
  });
});

describe("getGaslessWalletCreationFeeQueryOptions", () => {
  it("keys the query by chain, owner, wallet id, and config", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessWalletCreationFeeQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      walletId: 1n,
    });

    expect(options.enabled).toBe(true);
    expect(options.queryKey).toEqual([
      "getGaslessWalletCreationFee",
      {
        chainId: GASLESS_TEST_CHAIN,
        owner: OWNER,
        walletId: "1",
        configKey: config.getChainConfigKey(GASLESS_TEST_CHAIN),
      },
    ]);
  });

  it("shares one cache entry between an omitted wallet id and 0n", () => {
    const { config } = gaslessTestConfig();

    const omitted = getGaslessWalletCreationFeeQueryOptions(config, { owner: OWNER });
    const zero = getGaslessWalletCreationFeeQueryOptions(config, { owner: OWNER, walletId: 0n });

    expect(omitted.queryKey).toEqual(zero.queryKey);
  });

  it("honours query.enabled and forwards TanStack overrides without keying on them", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessWalletCreationFeeQueryOptions(config, {
      owner: OWNER,
      query: { enabled: false, staleTime: 30_000 },
    });

    expect(options.enabled).toBe(false);
    expect(options.staleTime).toBe(30_000);
    expect(options.queryKey[1]).not.toHaveProperty("query");
  });

  it("queryFn quotes the forwarded owner and wallet id on the forwarded chain", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValue(100_000n);
    /** The config's default chain has no gasless block, so a dropped `chainId` would throw instead. */
    expect(supportsGaslessService(config)).toBe(false);

    const options = getGaslessWalletCreationFeeQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      walletId: 4n,
    });

    await expect(options.queryFn()).resolves.toBe(100_000n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_GASLESS.gaslessLayerAddress,
        functionName: "getWalletCreationFee",
        args: [OWNER, 4n],
      }),
    );
  });
});
