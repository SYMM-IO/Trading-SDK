import { describe, expect, it } from "vitest";
import { supportsGaslessService } from "../resolve-gasless";
import { GASLESS_TEST_CHAIN, gaslessTestConfig } from "../test/config";
import { getGaslessDepositPolicyQueryKey, getGaslessDepositPolicyQueryOptions } from "./query";

const OWNER = "0x1111111111111111111111111111111111111111" as const;
const DEPOSIT_ADDRESS = "0x5555555555555555555555555555555555555555" as const;

describe("getGaslessDepositPolicyQueryKey", () => {
  it("tags the key with the action name and drops undefined fields", () => {
    expect(getGaslessDepositPolicyQueryKey({ chainId: undefined, owner: OWNER, configKey: "k" })).toEqual([
      "getGaslessDepositPolicy",
      { owner: OWNER, configKey: "k" },
    ]);
  });

  it("accepts no options at all", () => {
    expect(getGaslessDepositPolicyQueryKey()).toEqual(["getGaslessDepositPolicy", {}]);
  });
});

describe("getGaslessDepositPolicyQueryOptions", () => {
  it("keys the query by chain, owner, and config", () => {
    const { config } = gaslessTestConfig();

    const options = getGaslessDepositPolicyQueryOptions(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER });

    expect(options.enabled).toBe(true);
    expect(options.queryKey).toEqual([
      "getGaslessDepositPolicy",
      { chainId: GASLESS_TEST_CHAIN, owner: OWNER, configKey: config.getChainConfigKey(GASLESS_TEST_CHAIN) },
    ]);
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

  it("queryFn reads the policy for the forwarded owner on the forwarded chain", async () => {
    const { config, readContract } = gaslessTestConfig();
    readContract.mockImplementation(({ functionName }: { functionName: string }) => {
      if (functionName === "getGaslessWalletAddress") return Promise.resolve(DEPOSIT_ADDRESS);
      if (functionName === "collateralToken") return Promise.resolve(DEPOSIT_ADDRESS);
      return Promise.resolve(1n);
    });
    /** The config's default chain has no gasless block, so a dropped `chainId` would throw instead. */
    expect(supportsGaslessService(config)).toBe(false);

    const options = getGaslessDepositPolicyQueryOptions(config, { chainId: GASLESS_TEST_CHAIN, owner: OWNER });

    await expect(options.queryFn()).resolves.toMatchObject({ depositAddress: DEPOSIT_ADDRESS });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getGaslessWalletAddress", args: [OWNER] }),
    );
  });
});
