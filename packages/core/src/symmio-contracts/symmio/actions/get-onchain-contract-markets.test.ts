import { describe, expect, it } from "vitest";
import { mockConfig } from "../../../shared/test/mock-config";
import { getOnchainContractMarkets } from "./get-onchain-contract-markets";

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

describe("getOnchainContractMarkets", () => {
  it("reads paginated symbols from SYMMIO core", async () => {
    const { config, readContract } = mockConfig();
    readContract.mockResolvedValueOnce([SYMBOL]);

    const markets = await getOnchainContractMarkets(config, { start: 0, size: 100 });

    expect(markets).toEqual([SYMBOL]);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: config.getChainConfig().addresses.symmioAddress,
        functionName: "getSymbols",
        args: [0n, 100n],
      }),
    );
  });
});
