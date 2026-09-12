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
      { owner: OWNER, configKey: "k" },
    ]);
  });

  it("accepts no options at all", () => {
    expect(getGaslessWalletAddressQueryKey()).toEqual(["getGaslessWalletAddress", {}]);
  });
});

describe("getGaslessWalletAddressQueryOptions", () => {
  it("keys the query by chain, owner, and config", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessWalletAddressQueryOptions(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER });

    expect(options.enabled).toBe(true);
    expect(options.queryKey).toEqual([
      "getGaslessWalletAddress",
      { chainId: GASLESS_TEST_CHAIN, owner: OWNER, configKey: config.getChainConfigKey(GASLESS_TEST_CHAIN) },
    ]);
  });

  it("honours query.enabled", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessWalletAddressQueryOptions(config, { owner: OWNER, query: { enabled: false } });

    expect(options.enabled).toBe(false);
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
        args: [OWNER],
      }),
    );
  });
});
