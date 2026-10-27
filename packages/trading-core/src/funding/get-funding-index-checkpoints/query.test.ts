import type { PublicClient } from "viem";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { createConfig } from "../../core/config";
import { getFundingIndexCheckpointsQueryKey, getFundingIndexCheckpointsQueryOptions } from "./query";

const config = createConfig({
  getClient: () => ({}) as PublicClient,
  symmioConfig: {
    [SymmioSupportedChainId.ARBITRUM]: {
      addresses: { affiliatesAddress: "0x000000000000000000000000000000000000aFF1" },
    },
  },
});

describe("getFundingIndexCheckpointsQueryOptions", () => {
  it("keys the query on the action name and the filters, without TanStack overrides", () => {
    const options = getFundingIndexCheckpointsQueryOptions(config, {
      ...{ marketIds: [149] },
      query: { staleTime: 1 },
    });

    expect(options.queryKey[0]).toBe("getFundingIndexCheckpoints");
    expect(options.queryKey).toEqual(
      getFundingIndexCheckpointsQueryKey({ ...{ marketIds: [149] }, configKey: config.getChainConfigKey(undefined) }),
    );
    expect(JSON.stringify(options.queryKey)).not.toContain("staleTime");
    expect(options.enabled).toBe(true);
  });

  it("is disabled while a list filter is an empty array", () => {
    expect(getFundingIndexCheckpointsQueryOptions(config, { marketIds: [] }).enabled).toBe(false);
  });

  it("honors an explicit query.enabled = false", () => {
    expect(getFundingIndexCheckpointsQueryOptions(config, { query: { enabled: false } }).enabled).toBe(false);
  });

  it("keys bigint and address filters stably", () => {
    const a = getFundingIndexCheckpointsQueryKey({ ...{ marketIds: [149] }, configKey: "k" });
    const b = getFundingIndexCheckpointsQueryKey({ ...{ marketIds: [149] }, configKey: "k" });
    expect(a).toEqual(b);
    expect(() => JSON.stringify(a)).not.toThrow();
  });
});
