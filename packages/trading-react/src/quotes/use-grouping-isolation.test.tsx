import { SubAccountIsolationType } from "@symmio/trading-core";
import { renderHook } from "@testing-library/react";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useSubAccountMock, useVirtualAccountMock } = vi.hoisted(() => ({
  useSubAccountMock: vi.fn(),
  useVirtualAccountMock: vi.fn(),
}));
vi.mock("../account-layer/use-sub-account", () => ({ useSubAccount: useSubAccountMock }));
vi.mock("../account-layer/use-virtual-account", () => ({ useVirtualAccount: useVirtualAccountMock }));

import { useGroupingIsolation } from "./use-grouping-isolation";

const SUB: Address = "0x1111111111111111111111111111111111111111";
const PARENT_SUB: Address = "0x3333333333333333333333333333333333333333";
const VA: Address = "0x2222222222222222222222222222222222222222";

/** `useSubAccount` stub keyed by the address it is asked about. */
function stubSubAccounts(byAccount: Record<Address, { isExists: boolean; isolationType?: SubAccountIsolationType }>) {
  useSubAccountMock.mockImplementation(({ account }: { account?: Address }) => ({
    data: account ? byAccount[account] : undefined,
  }));
}

describe("useGroupingIsolation", () => {
  beforeEach(() => {
    useSubAccountMock.mockReset();
    useVirtualAccountMock.mockReset();
    useSubAccountMock.mockReturnValue({ data: undefined });
    useVirtualAccountMock.mockReturnValue({ data: undefined });
  });

  it("returns the isolation of a sub-account directly", () => {
    stubSubAccounts({ [SUB]: { isExists: true, isolationType: SubAccountIsolationType.MARKET_DIRECTION } });
    const { result } = renderHook(() => useGroupingIsolation({ account: SUB }));

    expect(result.current).toBe(SubAccountIsolationType.MARKET_DIRECTION);
    // the address resolved on the first hop, so the VA lookup stays disabled
    expect(useVirtualAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ enabled: false }) }),
    );
  });

  it("walks a Virtual Account up to its parent sub-account", () => {
    stubSubAccounts({
      [VA]: { isExists: false },
      [PARENT_SUB]: { isExists: true, isolationType: SubAccountIsolationType.CUSTOM },
    });
    useVirtualAccountMock.mockReturnValue({ data: { isExists: true, parentAccount: PARENT_SUB } });

    const { result } = renderHook(() => useGroupingIsolation({ account: VA }));

    expect(result.current).toBe(SubAccountIsolationType.CUSTOM);
    expect(useSubAccountMock).toHaveBeenCalledWith(expect.objectContaining({ account: PARENT_SUB }));
  });

  it("returns undefined while the reads are in flight", () => {
    const { result } = renderHook(() => useGroupingIsolation({ account: SUB }));
    expect(result.current).toBeUndefined();
  });

  it("returns undefined for an address that is neither a sub-account nor a VA", () => {
    stubSubAccounts({ [SUB]: { isExists: false } });
    useVirtualAccountMock.mockReturnValue({ data: { isExists: false, parentAccount: PARENT_SUB } });

    const { result } = renderHook(() => useGroupingIsolation({ account: SUB }));
    expect(result.current).toBeUndefined();
  });

  it("fires no read when disabled or without an account", () => {
    renderHook(() => useGroupingIsolation({ account: SUB, enabled: false }));
    expect(useSubAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ enabled: false }) }),
    );

    useSubAccountMock.mockClear();
    renderHook(() => useGroupingIsolation({}));
    expect(useSubAccountMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: expect.objectContaining({ enabled: false }) }),
    );
  });
});
