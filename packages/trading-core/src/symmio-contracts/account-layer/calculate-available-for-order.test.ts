import { describe, expect, it } from "vitest";
import { calculateAvailableForOrder } from "./calculate-available-for-order";
import type { AccountBalanceInfo } from "./types";

const ONE = 10n ** 18n;

function makeBalanceInfo(overrides: Partial<AccountBalanceInfo> = {}): AccountBalanceInfo {
  return {
    allocatedBalance: 1000n * ONE,
    lockedCVA: 50n * ONE,
    lockedLF: 10n * ONE,
    lockedPartyAMM: 100n * ONE,
    lockedPartyBMM: 0n,
    pendingLockedCVA: 5n * ONE,
    pendingLockedLF: 1n * ONE,
    pendingLockedPartyAMM: 4n * ONE,
    pendingLockedPartyBMM: 2n * ONE,
    ...overrides,
  };
}

describe("calculateAvailableForOrder", () => {
  it("adds profit and subtracts every locked + pending leg when upnl is positive", () => {
    // 1000 + 40 − (50+10+100) − (5+1+4+2) = 868
    expect(calculateAvailableForOrder({ balanceInfo: makeBalanceInfo(), upnl: 40n * ONE })).toBe(868n * ONE);
  });

  it("charges only the maintenance margin while a loss stays inside it", () => {
    // loss 60 < MM 100 → 1000 − 50 − 10 − 12 − max(60, 100) = 828
    expect(calculateAvailableForOrder({ balanceInfo: makeBalanceInfo(), upnl: -60n * ONE })).toBe(828n * ONE);
  });

  it("charges the loss once it exceeds the maintenance margin", () => {
    // loss 150 > MM 100 → 1000 − 50 − 10 − 12 − 150 = 778
    expect(calculateAvailableForOrder({ balanceInfo: makeBalanceInfo(), upnl: -150n * ONE })).toBe(778n * ONE);
  });

  it("goes negative when the account is under water", () => {
    const balanceInfo = makeBalanceInfo({ allocatedBalance: 100n * ONE });
    expect(calculateAvailableForOrder({ balanceInfo, upnl: -150n * ONE })).toBeLessThan(0n);
  });
});
