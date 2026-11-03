import { getChainConfig, SymmioSupportedChainId } from "@symmio/trading-core";
import { waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useWithdrawCooldownOf } from "./use-withdraw-cooldown-of";

const DEFAULT = getChainConfig(SymmioSupportedChainId.ARBITRUM);
const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("useWithdrawCooldownOf", () => {
  it("reads the stored deallocate timestamp from the SYMMIO core", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(1_700_000_000n);

    const { result } = renderHookWithProviders(() => useWithdrawCooldownOf({ user: SUB_ACCOUNT, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: DEFAULT.addresses.symmioAddress,
        functionName: "withdrawCooldownOf",
        args: [SUB_ACCOUNT],
      }),
    );
    expect(result.current.data).toBe(1_700_000_000n);
  });

  it("does not read while the caller disables the query", () => {
    const { config, readContract } = createMockSymmioConfig();

    const { result } = renderHookWithProviders(() =>
      useWithdrawCooldownOf({ user: SUB_ACCOUNT, config, query: { enabled: false } }),
    );

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("normalizes a failed read into a SymmioRequestError", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockRejectedValueOnce(new Error("rpc down"));

    const { result } = renderHookWithProviders(() =>
      useWithdrawCooldownOf({ user: SUB_ACCOUNT, config, query: { retry: false } }),
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ kind: expect.any(String) });
  });
});
