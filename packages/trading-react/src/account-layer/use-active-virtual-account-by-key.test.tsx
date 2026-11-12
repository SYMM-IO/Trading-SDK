import { getChainConfig, SymmioSupportedChainId, VIRTUAL_ACCOUNT_ISOLATION_TYPE } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import { zeroAddress } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { useActiveVirtualAccountByKey } from "./use-active-virtual-account-by-key";

const DEFAULT = getChainConfig(SymmioSupportedChainId.ARBITRUM);

describe("useActiveVirtualAccountByKey", () => {
  it("is disabled until the whole key is set and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() =>
      useActiveVirtualAccountByKey({
        subAccount: TEST_EOA,
        isolationType: VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_LONG,
        config,
      }),
    );

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads getActiveVAByKey and maps the zero address to null", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(zeroAddress);

    const { result } = renderHookWithProviders(() =>
      useActiveVirtualAccountByKey({
        subAccount: TEST_EOA,
        isolationType: VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_LONG,
        symbolId: 42n,
        config,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "getActiveVAByKey",
        args: [TEST_EOA, VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_LONG, 42n],
      }),
    );
  });
});
