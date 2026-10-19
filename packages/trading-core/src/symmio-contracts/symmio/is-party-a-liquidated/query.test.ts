import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { isPartyALiquidatedQueryKey, isPartyALiquidatedQueryOptions } from "./query";

describe("isPartyALiquidatedQueryOptions", () => {
  it("is disabled until `partyA` is set", () => {
    const { config } = mockConfig();
    expect(isPartyALiquidatedQueryOptions(config, {}).enabled).toBe(false);
    expect(isPartyALiquidatedQueryOptions(config, { partyA: TEST_USER }).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(isPartyALiquidatedQueryOptions(config, { partyA: TEST_USER, query: { enabled: false } }).enabled).toBe(
      false,
    );
  });

  it("queryFn delegates to the action", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(false);

    await expect(isPartyALiquidatedQueryOptions(config, { partyA: TEST_USER }).queryFn()).resolves.toBe(false);

    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ functionName: "isPartyALiquidated" }));
  });

  it("queryFn throws without `partyA`", () => {
    const { config } = mockConfig();
    expect(() => isPartyALiquidatedQueryOptions(config, {}).queryFn()).toThrow(SymmError);
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = isPartyALiquidatedQueryOptions(config, { partyA: TEST_USER, chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key", () => {
    expect(isPartyALiquidatedQueryKey({ chainId: SymmioSupportedChainId.ARBITRUM, partyA: TEST_USER })).toEqual([
      "isPartyALiquidated",
      { chainId: SymmioSupportedChainId.ARBITRUM, partyA: TEST_USER },
    ]);
  });
});
