import { describe, expect, it } from "vitest";
import { supportsGaslessService } from "../resolve-gasless";
import { GASLESS_TEST_CHAIN, TEST_GASLESS, gaslessTestConfig } from "../test/config";
import { getGaslessWalletAddressQueryKey, getGaslessWalletAddressQueryOptions } from "./query";

const OWNER = "0x1111111111111111111111111111111111111111" as const;
const WALLET = "0x5555555555555555555555555555555555555555" as const;

describe("getGaslessWalletAddressQueryKey", () => {
  it("tags the key with the action name and drops undefined fields", () => {
    expect(getGaslessWalletAddressQueryKey({ chainId: undefined, owner: OWNER, configKey: "k" })).toEqual([
      "getGaslessWalletAddress",
      { owner: OWNER, walletId: "0", configKey: "k" },
    ]);
  });

  it("keys an omitted wallet id as wallet 0", () => {
    expect(getGaslessWalletAddressQueryKey({ owner: OWNER })).toEqual(
      getGaslessWalletAddressQueryKey({ owner: OWNER, walletId: 0n }),
    );
    expect(getGaslessWalletAddressQueryKey({ owner: OWNER })).not.toEqual(
      getGaslessWalletAddressQueryKey({ owner: OWNER, walletId: 1n }),
    );
  });

  it("stringifies the wallet id so the key stays hashable", () => {
    const key = getGaslessWalletAddressQueryKey({ owner: OWNER, walletId: 2n });

    expect(key[1]).toMatchObject({ walletId: "2" });
    expect(() => JSON.stringify(key)).not.toThrow();
  });

  it("accepts no options at all", () => {
    expect(getGaslessWalletAddressQueryKey()).toEqual(["getGaslessWalletAddress", { walletId: "0" }]);
  });
});

describe("getGaslessWalletAddressQueryOptions", () => {
  it("keys the query by chain, owner, wallet id, and config", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessWalletAddressQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      walletId: 3n,
    });

    expect(options.enabled).toBe(true);
    expect(options.queryKey).toEqual([
      "getGaslessWalletAddress",
      {
        chainId: GASLESS_TEST_CHAIN,
        owner: OWNER,
        walletId: "3",
        configKey: config.getChainConfigKey(GASLESS_TEST_CHAIN),
      },
    ]);
  });

  it("shares one cache entry between an omitted wallet id and 0n", () => {
    const { config } = gaslessTestConfig();

    const omitted = getGaslessWalletAddressQueryOptions(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER });
    const zero = getGaslessWalletAddressQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      walletId: 0n,
    });

    expect(omitted.queryKey).toEqual(zero.queryKey);
  });

  it("honours query.enabled and forwards TanStack overrides without keying on them", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessWalletAddressQueryOptions(config, {
      owner: OWNER,
      query: { enabled: false, staleTime: 60_000 },
    });

    expect(options.enabled).toBe(false);
    expect(options.staleTime).toBe(60_000);
    expect(options.queryKey[1]).not.toHaveProperty("query");
  });

  it("queryFn reads the forwarded owner's wallet on the forwarded chain", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValue(WALLET);
    /** The config's default chain has no gasless block, so a dropped `chainId` would throw instead. */
    expect(supportsGaslessService(config)).toBe(false);

    const options = getGaslessWalletAddressQueryOptions(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER });

    await expect(options.queryFn()).resolves.toBe(WALLET);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: TEST_GASLESS.gaslessLayerAddress,
        functionName: "getGaslessWalletAddress",
        args: [OWNER, 0n],
      }),
    );
  });

  it("queryFn forwards the wallet id — a dropped one would silently read wallet 0", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockResolvedValue(WALLET);

    const options = getGaslessWalletAddressQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      walletId: 2n,
    });
    await options.queryFn();

    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getGaslessWalletAddress", args: [OWNER, 2n] }),
    );
  });
});
