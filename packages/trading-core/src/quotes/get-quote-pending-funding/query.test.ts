import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { getQuotePendingFundingQueryKey, getQuotePendingFundingQueryOptions } from "./query";

describe("getQuotePendingFundingQueryKey", () => {
  it("tags the key with the action name and stringifies bigint quote ids", () => {
    const key = getQuotePendingFundingQueryKey({ quoteIds: [7334n, 7335n], configKey: "k" });

    expect(key).toEqual(["getQuotePendingFunding", { quoteIds: ["7334", "7335"], configKey: "k" }]);
  });

  it("is independent of id order and repeats", () => {
    const ascending = getQuotePendingFundingQueryKey({ quoteIds: [9n, 10n, 100n], configKey: "k" });
    const shuffled = getQuotePendingFundingQueryKey({ quoteIds: [100n, 9n, 10n, 9n], configKey: "k" });

    expect(shuffled).toEqual(ascending);
    expect(shuffled[1].quoteIds).toEqual(["9", "10", "100"]);
  });

  it("never mutates the caller's quote-id array", () => {
    const quoteIds = [7335n, 7334n];

    getQuotePendingFundingQueryKey({ quoteIds, configKey: "k" });

    expect(quoteIds).toEqual([7335n, 7334n]);
  });

  it("accepts a partial { configKey } scope without quote ids", () => {
    expect(() => getQuotePendingFundingQueryKey({ configKey: "x" })).not.toThrow();
    expect(getQuotePendingFundingQueryKey({ configKey: "x" })).toEqual(["getQuotePendingFunding", { configKey: "x" }]);
  });

  it("accepts no options at all", () => {
    expect(getQuotePendingFundingQueryKey()).toEqual(["getQuotePendingFunding", {}]);
  });

  it("keeps the chain id and batch size in the key", () => {
    const key = getQuotePendingFundingQueryKey({
      chainId: SymmioSupportedChainId.ARBITRUM,
      quoteIds: [1n],
      batchSize: 10,
    });

    expect(key).toEqual([
      "getQuotePendingFunding",
      { chainId: SymmioSupportedChainId.ARBITRUM, quoteIds: ["1"], batchSize: 10 },
    ]);
  });
});

describe("getQuotePendingFundingQueryOptions", () => {
  it("is enabled and carries the config key when quote ids are present", () => {
    const { config } = mockConfig();

    const options = getQuotePendingFundingQueryOptions(config, { quoteIds: [7334n] });

    expect(options.enabled).toBe(true);
    expect(options.queryKey).toEqual([
      "getQuotePendingFunding",
      { quoteIds: ["7334"], configKey: config.getChainConfigKey() },
    ]);
  });

  it("is disabled when quoteIds is empty", () => {
    const { config } = mockConfig();

    expect(getQuotePendingFundingQueryOptions(config, { quoteIds: [] }).enabled).toBe(false);
  });

  it("respects an explicit query.enabled = false even with quote ids present", () => {
    const { config } = mockConfig();

    expect(getQuotePendingFundingQueryOptions(config, { quoteIds: [1n], query: { enabled: false } }).enabled).toBe(
      false,
    );
  });

  it("keeps query.enabled = true disabled while quoteIds is empty", () => {
    const { config } = mockConfig();

    expect(getQuotePendingFundingQueryOptions(config, { quoteIds: [], query: { enabled: true } }).enabled).toBe(false);
  });

  it("forwards TanStack overrides such as refetchInterval", () => {
    const { config } = mockConfig();

    const options = getQuotePendingFundingQueryOptions(config, {
      quoteIds: [1n],
      query: { refetchInterval: 60_000 },
    });

    expect(options.refetchInterval).toBe(60_000);
  });

  it("queryFn delegates to the action with chain id, ids and batch size", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([4n]).mockResolvedValueOnce([-6n]);

    const options = getQuotePendingFundingQueryOptions(config, {
      chainId: SymmioSupportedChainId.HYPER_EVM,
      quoteIds: [2n, 1n],
      batchSize: 1,
    });

    await expect(options.queryFn()).resolves.toEqual([
      { quoteId: 1n, pendingNetReceived: -4n },
      { quoteId: 2n, pendingNetReceived: 6n },
    ]);
    expect(readContract).toHaveBeenCalledTimes(2);
    expect(readContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ functionName: "getQuoteFundingDebts", args: [[1n]] }),
    );
    expect(readContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ functionName: "getQuoteFundingDebts", args: [[2n]] }),
    );
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();

    const options = getQuotePendingFundingQueryOptions(config, { chainId: mainnet.id, quoteIds: [1n] });

    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });
});
