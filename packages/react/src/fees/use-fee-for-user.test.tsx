import { waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders } from "../test/test-utils";
import { useFeeForUser } from "./use-fee-for-user";

const USER: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("useFeeForUser", () => {
  it("reads user fees and resolves data", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce({ openFee: 1n, closeFee: 2n, isSet: true });

    const { result } = renderHookWithProviders(() => useFeeForUser({ user: USER, symbolId: 7, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ openFee: 1n, closeFee: 2n, isSet: true });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: config.getChainConfig().addresses.symmioAddress,
        functionName: "getFeeForUser",
        args: [config.getChainConfig().addresses.affiliatesAddress, USER, 7n],
      }),
    );
  });

  it("normalizes thrown errors into a SymmioRequestError", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockRejectedValueOnce(new Error("kaboom"));

    const { result } = renderHookWithProviders(() => useFeeForUser({ user: USER, symbolId: 7, config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("unknown");
    expect(result.current.error?.message).toBe("kaboom");
  });
});
