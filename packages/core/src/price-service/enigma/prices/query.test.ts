import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import { getEnigmaPriceServicePricesQueryKey, getEnigmaPriceServicePricesQueryOptions } from "./query";

describe("getEnigmaPriceServicePricesQueryOptions", () => {
  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(
      getEnigmaPriceServicePricesQueryOptions(config, { addresses: "0xabc", query: { enabled: false } }).enabled,
    ).toBe(false);
  });

  it("is enabled by default when parameters are provided", () => {
    const { config } = mockConfig();
    expect(getEnigmaPriceServicePricesQueryOptions(config, { addresses: "0xabc" }).enabled).toBe(true);
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getEnigmaPriceServicePricesQueryOptions(config, { addresses: "0xabc", chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key", () => {
    const key = getEnigmaPriceServicePricesQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      addresses: ["0xabc", "0xdef"],
    });
    expect(key).toEqual([
      "getEnigmaPriceServicePrices",
      {
        chainId: SymmioSupportedChainId.HYPER_EVM,
        addresses: ["0xabc", "0xdef"],
      },
    ]);
  });
});
