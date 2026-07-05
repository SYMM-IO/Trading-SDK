import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { getMarketInfoQueryKey, getMarketInfoQueryOptions } from "./query";

describe("getMarketInfoQueryOptions", () => {
  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(getMarketInfoQueryOptions(config, { query: { enabled: false } }).enabled).toBe(false);
  });

  it("is enabled by default", () => {
    const { config } = mockConfig();
    expect(getMarketInfoQueryOptions(config, {}).enabled).toBe(true);
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getMarketInfoQueryOptions(config, { chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key including the chain id", () => {
    const key = getMarketInfoQueryKey({ chainId: SymmioSupportedChainId.HYPER_EVM });
    expect(key).toEqual(["getMarketInfo", { chainId: SymmioSupportedChainId.HYPER_EVM }]);
  });
});
