import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { getMarginTransfersQueryKey, getMarginTransfersQueryOptions } from "./query";

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.ARBITRUM]: {
      addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
    },
  },
});

describe("getMarginTransfersQueryOptions", () => {
  it("keys the query on the action name and the filters, without TanStack overrides", () => {
    const options = getMarginTransfersQueryOptions(config, {
      ...{ types: ["ADD"], transactions: ["0xabc" as const] },
      query: { staleTime: 1 },
    });

    expect(options.queryKey[0]).toBe("getMarginTransfers");
    expect(options.queryKey).toEqual(
      getMarginTransfersQueryKey({
        ...{ types: ["ADD"], transactions: ["0xabc" as const] },
        configKey: config.getChainConfigKey(undefined),
      }),
    );
    expect(JSON.stringify(options.queryKey)).not.toContain("staleTime");
    expect(options.enabled).toBe(true);
  });

  it("is disabled while a list filter is an empty array", () => {
    expect(getMarginTransfersQueryOptions(config, { transactions: [] }).enabled).toBe(false);
  });

  it("honors an explicit query.enabled = false", () => {
    expect(getMarginTransfersQueryOptions(config, { query: { enabled: false } }).enabled).toBe(false);
  });

  it("keys bigint and address filters stably", () => {
    const a = getMarginTransfersQueryKey({ ...{ types: ["ADD"], transactions: ["0xabc" as const] }, configKey: "k" });
    const b = getMarginTransfersQueryKey({ ...{ types: ["ADD"], transactions: ["0xabc" as const] }, configKey: "k" });
    expect(a).toEqual(b);
    expect(() => JSON.stringify(a)).not.toThrow();
  });
});
