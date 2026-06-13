import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import { getEnigmaPriceServicePricesByNamesQueryKey, getEnigmaPriceServicePricesByNamesQueryOptions } from "./query";

describe("getEnigmaPriceServicePricesByNamesQueryOptions", () => {
  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(
      getEnigmaPriceServicePricesByNamesQueryOptions(config, {
        names: ["BTCUSDT"],
        query: { enabled: false },
      }).enabled,
    ).toBe(false);
  });

  it("is enabled by default when parameters are provided", () => {
    const { config } = mockConfig();
    expect(getEnigmaPriceServicePricesByNamesQueryOptions(config, { names: ["BTCUSDT"] }).enabled).toBe(true);
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getEnigmaPriceServicePricesByNamesQueryOptions(config, {
      names: ["BTCUSDT"],
      chainId: mainnet.id,
    });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key", () => {
    const key = getEnigmaPriceServicePricesByNamesQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      names: ["BTCUSDT", "ETHUSDT"],
    });
    expect(key).toEqual([
      "getEnigmaPriceServicePricesByNames",
      {
        chainId: SymmioSupportedChainId.HYPER_EVM,
        names: ["BTCUSDT", "ETHUSDT"],
      },
    ]);
  });
});
