import { describe, expect, it } from "vitest";
import { supportsGaslessService } from "../resolve-gasless";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "../test/config";
import { getGaslessDepositPolicyQueryKey, getGaslessDepositPolicyQueryOptions } from "./query";

const OWNER = "0x1111111111111111111111111111111111111111" as const;
const DEPOSIT_ADDRESS = "0x5555555555555555555555555555555555555555" as const;
const COLLATERAL = "0x6666666666666666666666666666666666666666" as const;

describe("getGaslessDepositPolicyQueryKey", () => {
  it("tags the key with the action name and drops undefined fields", () => {
    expect(getGaslessDepositPolicyQueryKey({ chainId: undefined, owner: OWNER, configKey: "k" })).toEqual([
      "getGaslessDepositPolicy",
      { owner: OWNER, walletId: "0", configKey: "k" },
    ]);
  });

  it("keys an omitted wallet id as wallet 0", () => {
    expect(getGaslessDepositPolicyQueryKey({ owner: OWNER })).toEqual(
      getGaslessDepositPolicyQueryKey({ owner: OWNER, walletId: 0n }),
    );
    expect(getGaslessDepositPolicyQueryKey({ owner: OWNER })).not.toEqual(
      getGaslessDepositPolicyQueryKey({ owner: OWNER, walletId: 1n }),
    );
  });

  it("accepts no options at all", () => {
    expect(getGaslessDepositPolicyQueryKey()).toEqual(["getGaslessDepositPolicy", { walletId: "0" }]);
  });
});

describe("getGaslessDepositPolicyQueryOptions", () => {
  it("keys the query by chain, owner, wallet id, and config", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessDepositPolicyQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      walletId: 1n,
    });

    expect(options.enabled).toBe(true);
    expect(options.queryKey).toEqual([
      "getGaslessDepositPolicy",
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

    const omitted = getGaslessDepositPolicyQueryOptions(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER });
    const zero = getGaslessDepositPolicyQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      walletId: 0n,
    });

    expect(omitted.queryKey).toEqual(zero.queryKey);
  });

  it("honours query.enabled and forwards TanStack overrides without keying on them", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessDepositPolicyQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      query: { enabled: false, staleTime: 60_000 },
    });

    expect(options.enabled).toBe(false);
    expect(options.staleTime).toBe(60_000);
    expect(options.queryKey[1]).not.toHaveProperty("query");
  });

  it("queryFn reads the policy for the forwarded owner and wallet id on the forwarded chain", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "getGaslessWalletAddress") return Promise.resolve(DEPOSIT_ADDRESS);
      if (functionName === "collateralToken") return Promise.resolve(COLLATERAL);
      if (functionName === "decimals") return Promise.resolve(6);
      return Promise.resolve(1n);
    });
    /** The config's default chain has no gasless block, so a dropped `chainId` would throw instead. */
    expect(supportsGaslessService(config)).toBe(false);

    const options = getGaslessDepositPolicyQueryOptions(config, {
      chainId: GASLESS_TEST_CHAIN,
      owner: OWNER,
      walletId: 3n,
    });

    await expect(options.queryFn()).resolves.toMatchObject({
      walletId: 3n,
      depositAddress: DEPOSIT_ADDRESS,
      collateralDecimals: 6,
    });
    /** A dropped `walletId` would silently read wallet 0's address and creation fee. */
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getGaslessWalletAddress", args: [OWNER, 3n] }),
    );
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getWalletCreationFee", args: [OWNER, 3n] }),
    );
  });
});
