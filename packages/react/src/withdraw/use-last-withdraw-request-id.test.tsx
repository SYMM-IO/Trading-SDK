import { waitFor } from "@testing-library/react";
import { getChainConfig, SymmioSupportedChainId } from "@theoldvarorg/core";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useLastWithdrawRequestId } from "./use-last-withdraw-request-id";

const DEFAULT = getChainConfig(SymmioSupportedChainId.HYPER_EVM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("useLastWithdrawRequestId", () => {
  it("is disabled while `user` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useLastWithdrawRequestId({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads the last withdraw request id from the SYMMIO core", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(3n);

    const { result } = renderHookWithProviders(() => useLastWithdrawRequestId({ user: SUB_ACCOUNT, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "getLastWithdrawRequestId",
        args: [SUB_ACCOUNT],
      }),
    );
    expect(result.current.data).toBe(3n);
  });
});
