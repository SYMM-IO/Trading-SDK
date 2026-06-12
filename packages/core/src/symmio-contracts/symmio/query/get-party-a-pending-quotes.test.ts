import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { getPartyAPendingQuotesQueryKey, getPartyAPendingQuotesQueryOptions } from "./get-party-a-pending-quotes";

describe("getPartyAPendingQuotesQueryOptions", () => {
  it("is disabled until `partyA` is set", () => {
    const { config } = mockConfig();
    expect(getPartyAPendingQuotesQueryOptions(config, {}).enabled).toBe(false);
    expect(getPartyAPendingQuotesQueryOptions(config, { partyA: TEST_USER }).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(getPartyAPendingQuotesQueryOptions(config, { partyA: TEST_USER, query: { enabled: false } }).enabled).toBe(
      false,
    );
  });

  it("queryFn delegates to the action", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([]);

    await getPartyAPendingQuotesQueryOptions(config, { partyA: TEST_USER }).queryFn();

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "getPartyAPendingQuotes" }));
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getPartyAPendingQuotesQueryOptions(config, { partyA: TEST_USER, chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable, bigint-safe key", () => {
    const key = getPartyAPendingQuotesQueryKey({ chainId: SymmioSupportedChainId.HYPER_EVM, partyA: TEST_USER });
    expect(key).toEqual(["getPartyAPendingQuotes", { chainId: SymmioSupportedChainId.HYPER_EVM, partyA: TEST_USER }]);
  });
});
