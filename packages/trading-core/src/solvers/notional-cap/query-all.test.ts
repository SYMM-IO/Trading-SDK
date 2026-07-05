import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { getNotionalCapAllQueryKey, getNotionalCapAllQueryOptions } from "./query-all";

describe("getNotionalCapAllQueryOptions", () => {
  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(getNotionalCapAllQueryOptions(config, { query: { enabled: false } }).enabled).toBe(false);
  });

  it("is enabled by default", () => {
    const { config } = mockConfig();
    expect(getNotionalCapAllQueryOptions(config, {}).enabled).toBe(true);
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getNotionalCapAllQueryOptions(config, { chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key including the chain id", () => {
    const key = getNotionalCapAllQueryKey({ chainId: SymmioSupportedChainId.HYPER_EVM });
    expect(key).toEqual(["getNotionalCapAll", { chainId: SymmioSupportedChainId.HYPER_EVM }]);
  });
});
