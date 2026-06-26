import { waitFor } from "@testing-library/react";
import { getChainConfig, SymmioSupportedChainId, VIRTUAL_ACCOUNT_ISOLATION_TYPE } from "@theoldvarorg/core";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import type { SymmioRequestError } from "../errors/symmio-request-error";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { usePredictedNextVirtualAccount } from "./use-predicted-next-virtual-account";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PREDICTED: Address = "0xcccccccccccccccccccccccccccccccccccccccc";
const SYMBOL_ID = 1n;

describe("usePredictedNextVirtualAccount", () => {
  it("is disabled until all inputs are set and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() =>
      usePredictedNextVirtualAccount({ subAccount: SUB_ACCOUNT, config }),
    );

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads the predicted VA address with all inputs", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(PREDICTED);

    const { result } = renderHookWithProviders(() =>
      usePredictedNextVirtualAccount({
        subAccount: SUB_ACCOUNT,
        isolationType: VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_LONG,
        symbolId: SYMBOL_ID,
        config,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.accountLayerAddress,
        functionName: "predictNextVirtualAccountAddress",
        args: [SUB_ACCOUNT, VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_LONG, SYMBOL_ID],
      }),
    );
    expect(result.current.data).toBe(PREDICTED);
  });

  it("stays enabled when `isolationType` is the falsy POSITION (0)", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(PREDICTED);

    const { result } = renderHookWithProviders(() =>
      usePredictedNextVirtualAccount({
        subAccount: SUB_ACCOUNT,
        isolationType: VIRTUAL_ACCOUNT_ISOLATION_TYPE.POSITION,
        symbolId: SYMBOL_ID,
        config,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readContract.mock.calls[0]![0].args).toEqual([
      SUB_ACCOUNT,
      VIRTUAL_ACCOUNT_ISOLATION_TYPE.POSITION,
      SYMBOL_ID,
    ]);
  });

  it("normalizes a read failure into a SymmioRequestError", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHookWithProviders(() =>
      usePredictedNextVirtualAccount({
        subAccount: SUB_ACCOUNT,
        isolationType: VIRTUAL_ACCOUNT_ISOLATION_TYPE.MARKET_LONG,
        symbolId: SYMBOL_ID,
        config,
      }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as SymmioRequestError).kind).toBe("unknown");
  });
});
