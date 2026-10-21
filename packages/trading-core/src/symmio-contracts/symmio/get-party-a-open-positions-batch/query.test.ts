import type { Address } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig, TEST_USER } from "../../../shared/test/mock-config";
import { getPartyAOpenPositionsBatchQueryKey, getPartyAOpenPositionsBatchQueryOptions } from "./query";

const VA: Address = "0x00000000000000000000000000000000000000a1";

describe("getPartyAOpenPositionsBatchQueryOptions", () => {
  it("is disabled while `partyAs` is empty", () => {
    const { config } = mockConfig();
    expect(getPartyAOpenPositionsBatchQueryOptions(config, { partyAs: [] }).enabled).toBe(false);
    expect(getPartyAOpenPositionsBatchQueryOptions(config, { partyAs: [TEST_USER] }).enabled).toBe(true);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(
      getPartyAOpenPositionsBatchQueryOptions(config, { partyAs: [TEST_USER], query: { enabled: false } }).enabled,
    ).toBe(false);
  });

  it("queryFn delegates to the action with every parameter", async () => {
    const { config, multicall } = mockConfig();
    multicall.mockResolvedValueOnce([
      { status: "success", result: [] },
      { status: "success", result: false },
    ]);

    const results = await getPartyAOpenPositionsBatchQueryOptions(config, {
      partyAs: [{ partyA: VA, start: 5n }],
      size: 20n,
      includeLiquidationStatus: true,
      batchSize: 3,
    }).queryFn();

    expect(multicall).toHaveBeenCalledWith({
      allowFailure: true,
      contracts: [
        expect.objectContaining({ functionName: "getPartyAOpenPositions", args: [VA, 5n, 20n] }),
        expect.objectContaining({ functionName: "isPartyALiquidated", args: [VA] }),
      ],
    });
    expect(results).toEqual([
      { partyA: VA, start: 5n, status: "success", quotes: [], hasMore: false, isLiquidated: false },
    ]);
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getPartyAOpenPositionsBatchQueryOptions(config, { partyAs: [TEST_USER], chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable, bigint-safe key", () => {
    const key = getPartyAOpenPositionsBatchQueryKey({
      chainId: SymmioSupportedChainId.ARBITRUM,
      partyAs: [TEST_USER, { partyA: VA, start: 200n }],
      size: 200n,
      includeLiquidationStatus: true,
    });
    expect(key).toEqual([
      "getPartyAOpenPositionsBatch",
      {
        chainId: SymmioSupportedChainId.ARBITRUM,
        partyAs: [TEST_USER, { partyA: VA, start: "200" }],
        size: "200",
        includeLiquidationStatus: true,
      },
    ]);
  });
});
