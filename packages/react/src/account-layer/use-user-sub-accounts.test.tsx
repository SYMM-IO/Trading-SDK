import { SubAccountIsolationType, type SubAccountDetail } from "@symm-frontier/core";
import { waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders, TEST_EOA } from "../test/test-utils";
import { useUserSubAccounts } from "./use-user-sub-accounts";

vi.mock("@symm-frontier/core", async () => {
  const actual = await vi.importActual<typeof import("@symm-frontier/core")>("@symm-frontier/core");
  return {
    ...actual,
    getUserSubAccounts: vi.fn(),
  };
});

const core = await import("@symm-frontier/core");
const mockedGetUserSubAccounts = vi.mocked(core.getUserSubAccounts);

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

beforeEach(() => {
  mockedGetUserSubAccounts.mockReset();
});

describe("useUserSubAccounts", () => {
  it("is disabled while `user` is undefined and never calls core", async () => {
    const { result } = renderHookWithProviders(() => useUserSubAccounts({ user: undefined }));

    expect(result.current.isFetching).toBe(false);
    expect(result.current.status).toBe("pending");
    expect(mockedGetUserSubAccounts).not.toHaveBeenCalled();
  });

  it("calls core.getUserSubAccounts with the user and resolves data", async () => {
    mockedGetUserSubAccounts.mockResolvedValueOnce([SAMPLE]);

    const { result } = renderHookWithProviders(() => useUserSubAccounts({ user: TEST_EOA }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([SAMPLE]);
    expect(mockedGetUserSubAccounts).toHaveBeenCalledTimes(1);
    expect(mockedGetUserSubAccounts).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ user: TEST_EOA }),
    );
  });

  it("forwards offset, limit, and accountLayerAddress overrides", async () => {
    const override: Address = "0x1234567890123456789012345678901234567890";
    mockedGetUserSubAccounts.mockResolvedValueOnce([]);

    const { result } = renderHookWithProviders(() =>
      useUserSubAccounts({ user: TEST_EOA, offset: 5n, limit: 10n, accountLayerAddress: override }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedGetUserSubAccounts).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        user: TEST_EOA,
        offset: 5n,
        limit: 10n,
        accountLayerAddress: override,
      }),
    );
  });

  it("normalizes thrown errors into a SymmioRequestError", async () => {
    mockedGetUserSubAccounts.mockRejectedValueOnce(new Error("kaboom"));

    const { result } = renderHookWithProviders(() => useUserSubAccounts({ user: TEST_EOA }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe("unknown");
    expect(result.current.error?.message).toBe("kaboom");
  });

  it("respects an explicit enabled: false", async () => {
    const { result } = renderHookWithProviders(() => useUserSubAccounts({ user: TEST_EOA, enabled: false }));

    expect(result.current.isFetching).toBe(false);
    expect(mockedGetUserSubAccounts).not.toHaveBeenCalled();
  });
});
