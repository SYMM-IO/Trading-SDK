import { PositionType } from "@symmio/trading-core";
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  usePositionLiquidationState,
  type UsePositionLiquidationStateParameters,
} from "./use-position-liquidation-state";

afterEach(() => vi.useRealTimers());
it("expires the mark without polling and preserves authoritative liquidation", () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const account = "0x1111111111111111111111111111111111111111";
  const W = 10n ** 18n;
  const inputs: UsePositionLiquidationStateParameters = {
    positionId: 1n,
    account,
    positions: [{ id: 1n, account, symbolId: 1n, positionType: PositionType.LONG, quantity: W, openedPrice: 100n * W }],
    complete: true,
    liquidated: false,
    unpaidFundingDebt: 0n,
    mark: { price: 100n * W, updatedAt: 1000 },
    maxPriceAgeMs: 30_000,
    balance: {
      allocatedBalance: 30n * W,
      lockedCVA: 5n * W,
      lockedLF: 5n * W,
      lockedPartyAMM: 10n * W,
      lockedPartyBMM: 0n,
      pendingLockedCVA: 0n,
      pendingLockedLF: 0n,
      pendingLockedPartyAMM: 0n,
      pendingLockedPartyBMM: 0n,
    },
  };
  const { result, rerender } = renderHook((p) => usePositionLiquidationState(p), { initialProps: inputs });
  expect(result.current.status).toBe("ready");
  act(() => vi.advanceTimersByTime(30_000));
  expect(result.current.status).toBe("stale");
  rerender({ ...inputs, liquidated: true });
  expect(result.current).toMatchObject({ status: "liquidated", isLiquidated: true });
  rerender({
    ...inputs,
    account: "0x2222222222222222222222222222222222222222",
    mark: { price: 100n * W, updatedAt: Date.now() },
  });
  expect(result.current.status).toBe("unknown");
});
