import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../core/chains";
import { SymmError } from "../../shared/errors/symm-error";
import { mockConfig } from "../../shared/test/mock-config";
import { getSolverErrorCodesQueryKey, getSolverErrorCodesQueryOptions } from "./query";

describe("getSolverErrorCodesQueryOptions", () => {
  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(getSolverErrorCodesQueryOptions(config, { query: { enabled: false } }).enabled).toBe(false);
  });

  it("is enabled by default", () => {
    const { config } = mockConfig();
    expect(getSolverErrorCodesQueryOptions(config).enabled).toBe(true);
  });

  it("defaults staleTime to Infinity and lets the caller override it", () => {
    const { config } = mockConfig();
    expect(getSolverErrorCodesQueryOptions(config).staleTime).toBe(Infinity);
    expect(getSolverErrorCodesQueryOptions(config, { query: { staleTime: 0 } }).staleTime).toBe(0);
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getSolverErrorCodesQueryOptions(config, { chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key", () => {
    const key = getSolverErrorCodesQueryKey({ chainId: SymmioSupportedChainId.HYPER_EVM });
    expect(key).toEqual([
      "getSolverErrorCodes",
      {
        chainId: SymmioSupportedChainId.HYPER_EVM,
      },
    ]);
  });
});
