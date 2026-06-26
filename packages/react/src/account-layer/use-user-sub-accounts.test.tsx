import { SubAccountIsolationType, type SubAccountDetail } from "@theoldvarorg/core";
import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockSymmioConfig, renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { useUserSubAccounts } from "./use-user-sub-accounts";

const SAMPLE: SubAccountDetail = {
  owner: TEST_EOA,
  name: "First",
  metadata: "0x",
  isExists: true,
  singleVAMode: false,
  isolationType: SubAccountIsolationType.POSITION,
  affiliate: "0x0000000000000000000000000000000000000000",
  symmioCore: "0x57331038c21982116EE9b0906E4a5c5cB52dcE2e",
  accountAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};

describe("useUserSubAccounts", () => {
  it("is disabled while `user` is undefined and never reads", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() => useUserSubAccounts({ config }));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.status).toBe("pending");
    expect(readContract).not.toHaveBeenCalled();
  });

  it("reads subaccounts for the user and resolves data", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce([SAMPLE]);

    const { result } = renderHookWithProviders(() => useUserSubAccounts({ user: TEST_EOA, config }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([SAMPLE]);
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: "getUserSubAccounts", args: [TEST_EOA, 0n, 200n] }),
    );
  });

  it("forwards offset and limit", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockResolvedValueOnce([]);

    const { result } = renderHookWithProviders(() =>
      useUserSubAccounts({ user: TEST_EOA, offset: 5n, limit: 10n, config }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readContract).toHaveBeenCalledWith(expect.objectContaining({ args: [TEST_EOA, 5n, 10n] }));
  });

  it("normalizes thrown errors into a SymmioRequestError", async () => {
    const { config, readContract } = createMockSymmioConfig();
    readContract.mockRejectedValueOnce(new Error("kaboom"));

    const { result } = renderHookWithProviders(() => useUserSubAccounts({ user: TEST_EOA, config }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("unknown");
    expect(result.current.error?.message).toBe("kaboom");
  });

  it("respects query.enabled: false", () => {
    const { config, readContract } = createMockSymmioConfig();
    const { result } = renderHookWithProviders(() =>
      useUserSubAccounts({ user: TEST_EOA, config, query: { enabled: false } }),
    );

    expect(result.current.isFetching).toBe(false);
    expect(readContract).not.toHaveBeenCalled();
  });
});
