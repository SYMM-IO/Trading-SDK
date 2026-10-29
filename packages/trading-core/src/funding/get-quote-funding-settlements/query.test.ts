import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { getQuoteFundingSettlementsQueryKey, getQuoteFundingSettlementsQueryOptions } from "./query";

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.ARBITRUM]: {
      addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
    },
  },
});

describe("getQuoteFundingSettlementsQueryOptions", () => {
  it("keys the query on the action name and the filters, without TanStack overrides", () => {
    const options = getQuoteFundingSettlementsQueryOptions(config, {
      ...{ quoteIds: [7334n] },
      query: { staleTime: 1 },
    });

    expect(options.queryKey[0]).toBe("getQuoteFundingSettlements");
    expect(options.queryKey).toEqual(
      getQuoteFundingSettlementsQueryKey({ ...{ quoteIds: [7334n] }, configKey: config.getChainConfigKey(undefined) }),
    );
    expect(JSON.stringify(options.queryKey)).not.toContain("staleTime");
    expect(options.enabled).toBe(true);
  });

  it("is disabled while a list filter is an empty array", () => {
    expect(getQuoteFundingSettlementsQueryOptions(config, { quoteIds: [] }).enabled).toBe(false);
  });

  it("honors an explicit query.enabled = false", () => {
    expect(getQuoteFundingSettlementsQueryOptions(config, { query: { enabled: false } }).enabled).toBe(false);
  });

  it("keys bigint and address filters stably", () => {
    const a = getQuoteFundingSettlementsQueryKey({ ...{ quoteIds: [7334n] }, configKey: "k" });
    const b = getQuoteFundingSettlementsQueryKey({ ...{ quoteIds: [7334n] }, configKey: "k" });
    expect(a).toEqual(b);
    expect(() => JSON.stringify(a)).not.toThrow();
  });
});
