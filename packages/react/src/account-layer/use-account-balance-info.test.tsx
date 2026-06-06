import { waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useAccountBalanceInfo } from "./use-account-balance-info";

const ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("useAccountBalanceInfo", () => {
  it("is disabled while `account` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useAccountBalanceInfo({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.status).toBe("pending");
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads account balance info and resolves data", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce([1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n]);

    const { result } = renderHookWithProviders(() => useAccountBalanceInfo({ account: ACCOUNT, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      allocatedBalance: 1n,
      lockedCVA: 2n,
      lockedLF: 3n,
      lockedPartyAMM: 4n,
      lockedPartyBMM: 5n,
      pendingLockedCVA: 6n,
      pendingLockedLF: 7n,
      pendingLockedPartyAMM: 8n,
      pendingLockedPartyBMM: 9n,
    });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: config.getChainConfig().addresses.symmioAddress,
        functionName: "balanceInfoOfPartyA",
        args: [ACCOUNT],
      }),
    );
  });

  it("normalizes thrown errors into a SymmioRequestError", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockRejectedValueOnce(new Error("kaboom"));

    const { result } = renderHookWithProviders(() => useAccountBalanceInfo({ account: ACCOUNT, config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("unknown");
    expect(result.current.error?.message).toBe("kaboom");
  });
});
