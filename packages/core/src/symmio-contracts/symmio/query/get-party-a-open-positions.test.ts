import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { getPartyAOpenPositionsQueryKey, getPartyAOpenPositionsQueryOptions } from "./get-party-a-open-positions";

describe("getPartyAOpenPositionsQueryOptions", () => {
  it("is disabled until `partyA` is set", () => {
    const { config } = mockConfig();
    expect(getPartyAOpenPositionsQueryOptions(config, {}).enabled).toBe(false);
    expect(getPartyAOpenPositionsQueryOptions(config, { partyA: TEST_USER }).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(getPartyAOpenPositionsQueryOptions(config, { partyA: TEST_USER, query: { enabled: false } }).enabled).toBe(
      false,
    );
  });

  it("queryFn delegates to the action", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([]);

    await getPartyAOpenPositionsQueryOptions(config, { partyA: TEST_USER }).queryFn();

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "getPartyAOpenPositions" }));
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getPartyAOpenPositionsQueryOptions(config, { partyA: TEST_USER, chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable, bigint-safe key", () => {
    const key = getPartyAOpenPositionsQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      partyA: TEST_USER,
      start: 0n,
      size: 200n,
    });
    expect(key).toEqual([
      "getPartyAOpenPositions",
      { chainId: SymmioSupportedChainId.HYPER_EVM, partyA: TEST_USER, start: "0", size: "200" },
    ]);
  });
});
