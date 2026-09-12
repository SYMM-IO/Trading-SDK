import type { Address } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import { getFundingFeesOfPartyBQueryKey, getFundingFeesOfPartyBQueryOptions } from "./query";
import type { FundingFee } from "./types";

const PARTY_B: Address = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

/** A not-configured pair: the zeroed struct the view returns. */
const ZERO_FUNDING_FEE: FundingFee = {
  currentLongRate: 0n,
  currentShortRate: 0n,
  accumulatedLongRate: 0n,
  accumulatedShortRate: 0n,
  lastUpdatedEpoch: 0n,
  lastUpdatedTimeStamp: 0n,
  startEpochTimeStamp: 0n,
  startEpoch: 0n,
  epochDuration: 0n,
  snapshotLongFee: 0n,
  snapshotShortFee: 0n,
};

describe("getFundingFeesOfPartyBQueryKey", () => {
  it("builds a stable key with the bigint symbol id stringified", () => {
    const key = getFundingFeesOfPartyBQueryKey({
      chainId: SymmioSupportedChainId.ARBITRUM,
      symbolId: 7n,
      partyB: PARTY_B,
    });

    expect(key).toEqual([
      "getFundingFeesOfPartyB",
      { chainId: SymmioSupportedChainId.ARBITRUM, symbolId: "7", partyB: PARTY_B },
    ]);
  });
});

describe("getFundingFeesOfPartyBQueryOptions", () => {
  it("is enabled by default and carries the config key", () => {
    const { config } = mockConfig();

    const options = getFundingFeesOfPartyBQueryOptions(config, { symbolId: 7n, partyB: PARTY_B });

    expect(options.enabled).toBe(true);
    expect(options.queryKey).toEqual([
      "getFundingFeesOfPartyB",
      { symbolId: "7", partyB: PARTY_B, configKey: config.getChainConfigKey() },
    ]);
  });

  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();

    expect(
      getFundingFeesOfPartyBQueryOptions(config, { symbolId: 7n, partyB: PARTY_B, query: { enabled: false } }).enabled,
    ).toBe(false);
  });

  it("queryFn delegates to the contract read", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce(ZERO_FUNDING_FEE);

    const options = getFundingFeesOfPartyBQueryOptions(config, { symbolId: 7n, partyB: PARTY_B });

    await expect(options.queryFn()).resolves.toEqual(ZERO_FUNDING_FEE);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getFundingFeesOfPartyB", args: [7n, PARTY_B] }),
    );
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();

    const options = getFundingFeesOfPartyBQueryOptions(config, {
      chainId: mainnet.id,
      symbolId: 7n,
      partyB: PARTY_B,
    });

    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });
});
