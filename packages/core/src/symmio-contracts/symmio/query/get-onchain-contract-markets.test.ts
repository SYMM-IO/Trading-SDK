import { mainnet } from "viem/chains";
import { describe, expect, it } from "vitest";
import { SymmioSupportedChainId } from "../../../core/chains";
import { SymmError } from "../../../shared/errors/symm-error";
import { mockConfig } from "../../../shared/test/mock-config";
import {
  getOnchainContractMarketsQueryKey,
  getOnchainContractMarketsQueryOptions,
} from "./get-onchain-contract-markets";

const SYMBOL = {
  symbolId: 1n,
  name: "BTCUSDT",
  isValid: true,
  minAcceptableQuoteValue: 10n,
  minAcceptablePortionLF: 20n,
  tradingFee: 30n,
  maxLeverage: 50n,
  fundingRateEpochDuration: 60n,
  fundingRateWindowTime: 70n,
};

describe("getOnchainContractMarketsQueryOptions", () => {
  it("respects an explicit query.enabled override", () => {
    const { config } = mockConfig();
    expect(
      getOnchainContractMarketsQueryOptions(config, { start: 0, size: 100, query: { enabled: false } }).enabled,
    ).toBe(false);
  });

  it("is enabled by default when parameters are provided", () => {
    const { config } = mockConfig();
    expect(getOnchainContractMarketsQueryOptions(config, { start: 0, size: 100 }).enabled).toBe(true);
  });

  it("queryFn delegates to the contract read", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([SYMBOL]);

    const options = getOnchainContractMarketsQueryOptions(config, { start: 0, size: 100 });

    await expect(options.queryFn()).resolves.toEqual([SYMBOL]);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "getSymbols",
        args: [0n, 100n],
      }),
    );
  });

  it("queryFn surfaces a SymmError for an unsupported chain", async () => {
    const { config } = mockConfig();
    const options = getOnchainContractMarketsQueryOptions(config, { start: 0, size: 100, chainId: mainnet.id });
    await expect(options.queryFn()).rejects.toThrow(SymmError);
  });

  it("builds a stable key", () => {
    const key = getOnchainContractMarketsQueryKey({
      chainId: SymmioSupportedChainId.HYPER_EVM,
      start: 0,
      size: 100,
    });

    expect(key).toEqual([
      "getOnchainContractMarkets",
      {
        chainId: SymmioSupportedChainId.HYPER_EVM,
        start: 0,
        size: 100,
      },
    ]);
  });
});
