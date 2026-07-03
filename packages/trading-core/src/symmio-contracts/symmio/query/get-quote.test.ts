import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import { getQuoteQueryKey, getQuoteQueryOptions } from "./get-quote";

describe("getQuoteQueryOptions", () => {
  it("is disabled until `quoteId` is set", () => {
    const { config } = mockConfig();
    expect(getQuoteQueryOptions(config, {}).enabled).toBe(false);
    expect(getQuoteQueryOptions(config, { quoteId: 1n }).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(getQuoteQueryOptions(config, { quoteId: 1n, query: { enabled: false } }).enabled).toBe(false);
  });

  it("queryFn delegates to the action", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce({ id: 1n });

    await getQuoteQueryOptions(config, { quoteId: 1n }).queryFn();

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "getQuote", args: [1n] }));
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getQuoteQueryOptions(config, { quoteId: 1n, chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable, bigint-safe key", () => {
    const key = getQuoteQueryKey({ chainId: SymmioSupportedChainId.HYPER_EVM, quoteId: 42n });
    expect(key).toEqual(["getQuote", { chainId: SymmioSupportedChainId.HYPER_EVM, quoteId: "42" }]);
  });
});
