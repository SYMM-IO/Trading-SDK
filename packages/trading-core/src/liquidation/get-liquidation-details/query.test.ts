import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { getLiquidationDetailsQueryKey, getLiquidationDetailsQueryOptions } from "./query";

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.ARBITRUM]: {
      addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
    },
  },
});

describe("getLiquidationDetailsQueryOptions", () => {
  it("keys the query on the action name and the filters, without TanStack overrides", () => {
    const options = getLiquidationDetailsQueryOptions(config, {
      ...{ partyAs: ["0xF55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A" as const] },
      query: { staleTime: 1 },
    });

    expect(options.queryKey[0]).toBe("getLiquidationDetails");
    expect(options.queryKey).toEqual(
      getLiquidationDetailsQueryKey({
        ...{ partyAs: ["0xF55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A" as const] },
        configKey: config.getChainConfigKey(undefined),
      }),
    );
    expect(JSON.stringify(options.queryKey)).not.toContain("staleTime");
    expect(options.enabled).toBe(true);
  });

  it("is disabled while a list filter is an empty array", () => {
    expect(getLiquidationDetailsQueryOptions(config, { partyAs: [] }).enabled).toBe(false);
  });

  it("honors an explicit query.enabled = false", () => {
    expect(getLiquidationDetailsQueryOptions(config, { query: { enabled: false } }).enabled).toBe(false);
  });

  it("keys bigint and address filters stably", () => {
    const a = getLiquidationDetailsQueryKey({
      ...{ partyAs: ["0xF55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A" as const] },
      configKey: "k",
    });
    const b = getLiquidationDetailsQueryKey({
      ...{ partyAs: ["0xF55534BBf9011ca7Ad84b804fdA9E7f4bE18Fe8A" as const] },
      configKey: "k",
    });
    expect(a).toEqual(b);
    expect(() => JSON.stringify(a)).not.toThrow();
  });
});
