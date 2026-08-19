import type { AccountBalanceInfo } from "@symmio/trading-core";
import { renderHook } from "@testing-library/react";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SymmioRequestError } from "../errors/symmio-request-error";

/**
 * Both collaborators are mocked: the on-chain read (so no network) and core's
 * pure fold (so this test pins the delegation contract, while the arithmetic
 * stays covered by core's own `calculate-margin-risk.test.ts`).
 */
const { useAccountBalanceInfoMock, calculateMarginRiskMock } = vi.hoisted(() => ({
  useAccountBalanceInfoMock: vi.fn(),
  calculateMarginRiskMock: vi.fn(),
}));

vi.mock("../account-layer/use-account-balance-info", () => ({
  useAccountBalanceInfo: useAccountBalanceInfoMock,
}));
vi.mock("@symmio/trading-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@symmio/trading-core")>();
  return { ...actual, calculateMarginRisk: calculateMarginRiskMock };
});

import { useAccountMarginRisk } from "./use-account-margin-risk";

const ACCOUNT: Address = "0x1111111111111111111111111111111111111111";

const BALANCE: AccountBalanceInfo = {
  allocatedBalance: 1000n,
  lockedCVA: 40n,
  lockedLF: 10n,
  lockedPartyAMM: 100n,
  lockedPartyBMM: 0n,
  pendingLockedCVA: 0n,
  pendingLockedLF: 0n,
  pendingLockedPartyAMM: 0n,
  pendingLockedPartyBMM: 0n,
};

const METRICS = { totalMargin: 1000n, isLiquidatable: false };

function mockBalance(overrides: Partial<{ data: AccountBalanceInfo; isLoading: boolean; error: unknown }> = {}) {
  useAccountBalanceInfoMock.mockReturnValue({ data: undefined, isLoading: false, error: null, ...overrides });
}

beforeEach(() => {
  vi.clearAllMocks();
  calculateMarginRiskMock.mockReturnValue(METRICS);
  mockBalance();
});

describe("useAccountMarginRisk", () => {
  it("stays idle without an account", () => {
    const { result } = renderHook(() => useAccountMarginRisk());
    expect(result.current.metrics).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
    expect(calculateMarginRiskMock).not.toHaveBeenCalled();
  });

  it("withholds metrics while the balance is loading", () => {
    mockBalance({ isLoading: true });
    const { result } = renderHook(() => useAccountMarginRisk({ account: ACCOUNT }));
    expect(result.current.metrics).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
  });

  it("folds the balance fields with the given uPnL", () => {
    mockBalance({ data: BALANCE });
    const { result } = renderHook(() => useAccountMarginRisk({ account: ACCOUNT, upnl: -25n }));
    expect(calculateMarginRiskMock).toHaveBeenCalledWith({ ...BALANCE, upnl: -25n });
    expect(result.current.metrics).toBe(METRICS);
    expect(result.current.balanceInfo).toBe(BALANCE);
  });

  it("treats an omitted uPnL as a flat book", () => {
    mockBalance({ data: BALANCE });
    renderHook(() => useAccountMarginRisk({ account: ACCOUNT }));
    expect(calculateMarginRiskMock).toHaveBeenCalledWith(expect.objectContaining({ upnl: 0n }));
  });

  it("subscribes to settles by default so the figures do not lag a trade", () => {
    mockBalance({ data: BALANCE });
    renderHook(() => useAccountMarginRisk({ account: ACCOUNT }));
    expect(useAccountBalanceInfoMock).toHaveBeenCalledWith(expect.objectContaining({ account: ACCOUNT, live: true }));
  });

  it("surfaces a normalized read error", () => {
    const error = new SymmioRequestError({ kind: "rpc", message: "boom" });
    mockBalance({ error });
    const { result } = renderHook(() => useAccountMarginRisk({ account: ACCOUNT }));
    expect(result.current.error).toBe(error);
  });

  it("returns a referentially stable object across re-renders", () => {
    mockBalance({ data: BALANCE });
    const { result, rerender } = renderHook(() => useAccountMarginRisk({ account: ACCOUNT, upnl: 5n }));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
