import { waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { useUserSubAccountsAddresses } from "./use-user-sub-accounts-addresses";

const SUB_ACCOUNT: Address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("useUserSubAccountsAddresses", () => {
  it("reads addresses with default pagination", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce([SUB_ACCOUNT]);

    const { result } = renderHookWithProviders(() => useUserSubAccountsAddresses({ user: TEST_EOA, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([SUB_ACCOUNT]);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getUserSubAccountsAddresses", args: [TEST_EOA, 0n, 200n] }),
    );
  });

  it("forwards offset and limit", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce([]);

    const { result } = renderHookWithProviders(() =>
      useUserSubAccountsAddresses({ user: TEST_EOA, offset: 5n, limit: 10n, config }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ args: [TEST_EOA, 5n, 10n] }));
  });
});
