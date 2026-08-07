import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { createConfig } from "../../core/config";
import { getQuoteFundingQueryKey, getQuoteFundingQueryOptions } from "./query";

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: { 999: { addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" } } },
});

describe("getQuoteFundingQueryKey", () => {
  it("tags the key with the action name and stringifies bigint quote ids", () => {
    const key = getQuoteFundingQueryKey({ quoteIds: [7334n, 7335n], configKey: "k" });

    expect(key[0]).toBe("getQuoteFunding");
    expect(key[1]).toMatchObject({ quoteIds: ["7334", "7335"], configKey: "k" });
  });
});

describe("getQuoteFundingQueryOptions", () => {
  it("is enabled, wires the action, and carries a stringified key when quote ids are present", () => {
    const options = getQuoteFundingQueryOptions(config, { quoteIds: [7334n] });

    expect(options.enabled).toBe(true);
    expect(options.queryKey[0]).toBe("getQuoteFunding");
    expect(options.queryKey[1]).toMatchObject({ quoteIds: ["7334"] });
    expect(typeof options.queryFn).toBe("function");
  });

  it("is disabled when quoteIds is empty", () => {
    expect(getQuoteFundingQueryOptions(config, { quoteIds: [] }).enabled).toBe(false);
  });

  it("respects an explicit query.enabled = false even with quote ids present", () => {
    expect(getQuoteFundingQueryOptions(config, { quoteIds: [7334n], query: { enabled: false } }).enabled).toBe(false);
  });
});
