import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { getFundingInfoQueryKey, getFundingInfoQueryOptions } from "./query";

describe("getFundingInfoQueryOptions", () => {
  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(getFundingInfoQueryOptions(config, { query: { enabled: false } }).enabled).toBe(false);
  });

  it("is enabled by default", () => {
    const { config } = mockConfig();
    expect(getFundingInfoQueryOptions(config, {}).enabled).toBe(true);
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getFundingInfoQueryOptions(config, { chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key including the symbols filter", () => {
    const key = getFundingInfoQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      symbols: ["BTCUSDT"],
    });
    expect(key).toEqual([
      "getFundingInfo",
      {
        chainId: SymmioSupportedChainId.HYPER_EVM,
        symbols: ["BTCUSDT"],
      },
    ]);
  });
});
