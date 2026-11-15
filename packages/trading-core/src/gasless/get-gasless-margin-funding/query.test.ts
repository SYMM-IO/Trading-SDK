import { encodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";
import { accountLayerAbi } from "../../symmio-contracts/abi/v0.8.6/account-layer";
import { getGaslessBatchFundingQueryKey, getGaslessBatchFundingQueryOptions } from "../get-gasless-batch-funding/query";
import { GASLESS_TEST_CHAIN } from "../test/config";
import { FUNDING_ACCOUNT as ACCOUNT, FUNDING_VA as VA, fundingTestConfig } from "../test/funding";
import { getGaslessMarginFundingQueryKey, getGaslessMarginFundingQueryOptions } from "./query";

const input = {
  chainId: GASLESS_TEST_CHAIN,
  account: ACCOUNT,
  parentAccount: ACCOUNT,
  virtualAccount: VA,
  direction: "add" as const,
  amount18: 100n,
  calls: [{ functionName: "addMargin", args: [VA, 100n] }],
};

describe("funding query keys", () => {
  it("keys equivalent encoded and ABI calls identically", () => {
    const data = encodeFunctionData({ abi: accountLayerAbi, functionName: "addMargin", args: [VA, 100n] });
    expect(getGaslessMarginFundingQueryKey({ ...input, calls: [{ data }] })).toEqual(
      getGaslessMarginFundingQueryKey(input),
    );
    expect(getGaslessBatchFundingQueryKey({ ...input, calls: [{ data }] })).toEqual(
      getGaslessBatchFundingQueryKey(input),
    );
  });

  it("isolates chain, config, account, calls and every margin projection input", () => {
    const key = getGaslessMarginFundingQueryKey(input);
    for (const change of [
      { chainId: 8453 },
      { configKey: "another-deployment" },
      { account: VA },
      { parentAccount: VA },
      { virtualAccount: ACCOUNT },
      { direction: "remove" as const },
      { amount18: 99n },
      { calls: [{ functionName: "addMargin", args: [VA, 99n] }] },
    ])
      expect(getGaslessMarginFundingQueryKey({ ...input, ...change })).not.toEqual(key);
  });

  it("includes generic projected balance movements in the batch key", () => {
    expect(
      getGaslessBatchFundingQueryKey({ ...input, balanceChanges: [{ account: ACCOUNT, delta18: -5n }] }),
    ).not.toEqual(getGaslessBatchFundingQueryKey({ ...input, balanceChanges: [{ account: ACCOUNT, delta18: -6n }] }));
  });

  it("does not throw while building keys for unencodable form inputs", () => {
    expect(() =>
      getGaslessMarginFundingQueryKey({ ...input, calls: [{ functionName: "addMargin", args: [VA, "bad"] }] }),
    ).not.toThrow();
  });
});

describe("funding query options", () => {
  it("forwards the margin context and preserves query overrides", async () => {
    const { config } = fundingTestConfig();
    const options = getGaslessMarginFundingQueryOptions(config, { ...input, query: { enabled: false } });
    expect(options.enabled).toBe(false);
    expect(options.staleTime).toBe(0);
    expect(options.queryKey[1]).toMatchObject({ configKey: config.getChainConfigKey(input.chainId) });
    await expect(options.queryFn()).resolves.toMatchObject({ hasSufficientBalance: false, maxAddAmount18: 95n });
  });

  it("forwards all batch movements", async () => {
    const { config } = fundingTestConfig();
    const options = getGaslessBatchFundingQueryOptions(config, {
      ...input,
      balanceChanges: [{ account: ACCOUNT, delta18: -100n }],
    });
    expect(options.enabled).toBe(true);
    await expect(options.queryFn()).resolves.toMatchObject({ hasSufficientBalance: false });
  });
});
