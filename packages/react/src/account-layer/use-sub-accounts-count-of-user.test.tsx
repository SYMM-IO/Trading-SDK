import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { useSubAccountsCountOfUser } from "./use-sub-accounts-count-of-user";

describe("useSubAccountsCountOfUser", () => {
  it("is disabled while `user` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useSubAccountsCountOfUser({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads the count for the user and resolves data", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce(3n);

    const { result } = renderHookWithProviders(() => useSubAccountsCountOfUser({ user: TEST_EOA, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(3n);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getSubAccountsCountOfUser", args: [TEST_EOA] }),
    );
  });
});
