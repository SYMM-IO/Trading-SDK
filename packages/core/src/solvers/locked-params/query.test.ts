import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { getLockedParamsQueryKey, getLockedParamsQueryOptions } from "./query";

describe("getLockedParamsQueryOptions", () => {
  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(
      getLockedParamsQueryOptions(config, { symbol: "BTCUSDT", leverage: 5, query: { enabled: false } }).enabled,
    ).toBe(false);
  });

  it("is enabled by default when parameters are provided", () => {
    const { config } = mockConfig();
    expect(getLockedParamsQueryOptions(config, { symbol: "BTCUSDT", leverage: 5 }).enabled).toBe(true);
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getLockedParamsQueryOptions(config, { symbol: "BTCUSDT", leverage: 5, chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key", () => {
    const key = getLockedParamsQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      symbol: "BTCUSDT",
      leverage: 5,
    });
    expect(key).toEqual([
      "getLockedParams",
      {
        chainId: SymmioSupportedChainId.HYPER_EVM,
        symbol: "BTCUSDT",
        leverage: 5,
      },
    ]);
  });
});
