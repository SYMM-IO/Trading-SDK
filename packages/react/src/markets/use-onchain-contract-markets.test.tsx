import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useOnchainContractMarkets } from "./use-onchain-contract-markets";

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

describe("useOnchainContractMarkets", () => {
  it("reads on-chain contract markets and resolves data", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce([SYMBOL]);

    const { result } = renderHookWithProviders(() => useOnchainContractMarkets({ start: 0, size: 100, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([SYMBOL]);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: config.getChainConfig().addresses.symmioAddress,
        functionName: "getSymbols",
        args: [0n, 100n],
      }),
    );
  });

  it("normalizes thrown errors into a SymmioRequestError", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockRejectedValueOnce(new Error("kaboom"));

    const { result } = renderHookWithProviders(() => useOnchainContractMarkets({ start: 0, size: 100, config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("unknown");
    expect(result.current.error?.message).toBe("kaboom");
  });
});
