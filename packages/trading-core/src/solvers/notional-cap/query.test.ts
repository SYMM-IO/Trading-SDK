import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { getNotionalCapBySymbolIdQueryKey, getNotionalCapBySymbolIdQueryOptions } from "./query";

describe("getNotionalCapBySymbolIdQueryOptions", () => {
  it("is enabled for a positive symbolId", () => {
    const { config } = mockConfig();
    expect(getNotionalCapBySymbolIdQueryOptions(config, { symbolId: 132 }).enabled).toBe(true);
  });

  it("is disabled when symbolId is 0 (the no-market sentinel)", () => {
    const { config } = mockConfig();
    expect(getNotionalCapBySymbolIdQueryOptions(config, { symbolId: 0 }).enabled).toBe(false);
  });

  it("respects an explicit query.enabled override even with a positive symbolId", () => {
    const { config } = mockConfig();
    expect(getNotionalCapBySymbolIdQueryOptions(config, { symbolId: 132, query: { enabled: false } }).enabled).toBe(
      false,
    );
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getNotionalCapBySymbolIdQueryOptions(config, { chainId: mainnet.id, symbolId: 132 });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key including the chain id and symbolId", () => {
    const key = getNotionalCapBySymbolIdQueryKey({ chainId: SymmioSupportedChainId.HYPER_EVM, symbolId: 132 });
    expect(key).toEqual(["getNotionalCapBySymbolId", { chainId: SymmioSupportedChainId.HYPER_EVM, symbolId: 132 }]);
  });
});
