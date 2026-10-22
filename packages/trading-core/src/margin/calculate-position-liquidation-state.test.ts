import { describe, expect, it } from "vitest";
import { PositionType } from "../symmio-contracts/symmio/types";
import {
  calculatePositionLiquidationState,
  type CalculatePositionLiquidationStateParameters,
} from "./calculate-position-liquidation-state";

const W = 10n ** 18n;
const account = "0x0000000000000000000000000000000000000001";
function snapshot(side = PositionType.LONG): CalculatePositionLiquidationStateParameters {
  return {
    account,
    positionId: 1n,
    complete: true,
    liquidated: false,
    unpaidFundingDebt: 0n,
    positions: [{ id: 1n, account, symbolId: 1n, quantity: W, openedPrice: 100n * W, positionType: side }],
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
    mark: { price: 100n * W, updatedAt: 1000 },
    nowMs: 1000,
    maxPriceAgeMs: 30_000,
  };
}
describe("position liquidation state", () => {
  it.each([PositionType.LONG, PositionType.SHORT])(
    "distinguishes threshold, equality and liquidation for side %s",
    (side) => {
      const p = snapshot(side);
      const sign = side === PositionType.LONG ? -1n : 1n;
      p.mark!.price = (100n + sign * 15n) * W;
      expect(calculatePositionLiquidationState(p).isAtRisk).toBe(false);
      p.mark!.price += sign;
      expect(calculatePositionLiquidationState(p).isAtRisk).toBe(true);
      p.mark!.price = (100n + sign * 20n) * W;
      expect(calculatePositionLiquidationState(p)).toMatchObject({
        isAtRisk: true,
        isLiquidatable: false,
        isLiquidated: false,
      });
      p.mark!.price += sign;
      expect(calculatePositionLiquidationState(p)).toMatchObject({ isLiquidatable: true, isLiquidated: false });
    },
  );
  it("counts pending locks and funding once for every quote sharing a VA", () => {
    const p = snapshot();
    p.balance!.pendingLockedCVA = W;
    p.unpaidFundingDebt = 2n * W;
    p.positions = [...p.positions, { ...p.positions[0]!, id: 2n }];
    const first = calculatePositionLiquidationState(p);
    expect(first.liquidationPrice).toBe(91_500_000_000_000_000_000n);
    expect(calculatePositionLiquidationState({ ...p, positionId: 2n })).toEqual(first);
  });
  it("does not mistake stale or incomplete data for healthy data", () => {
    const p = snapshot();
    expect(calculatePositionLiquidationState({ ...p, nowMs: 31_000 }).status).toBe("stale");
    expect(calculatePositionLiquidationState({ ...p, complete: false }).status).toBe("unknown");
    expect(calculatePositionLiquidationState({ ...p, balance: undefined }).status).toBe("unknown");
    expect(calculatePositionLiquidationState({ ...p, liquidated: true, mark: undefined }).status).toBe("liquidated");
  });
  it("rejects mixed domains and empty closing VAs", () => {
    const p = snapshot();
    expect(
      calculatePositionLiquidationState({
        ...p,
        positions: [...p.positions, { ...p.positions[0]!, id: 2n, symbolId: 2n }],
      }).status,
    ).toBe("unknown");
    p.balance = { ...p.balance!, allocatedBalance: 0n, lockedCVA: 0n, lockedLF: 0n };
    expect(calculatePositionLiquidationState(p).status).toBe("unknown");
  });
});

it("uses remaining size after a partial close and keeps distinct VAs independent", () => {
  const p = snapshot();
  p.positions = [{ ...p.positions[0]!, closedAmount: W / 2n }];
  expect(calculatePositionLiquidationState(p).liquidationPrice).toBe(60n * W);
  const other = snapshot();
  other.balance!.allocatedBalance = 40n * W;
  expect(calculatePositionLiquidationState(other).liquidationPrice).toBe(70n * W);
  expect(calculatePositionLiquidationState(p).liquidationPrice).toBe(60n * W);
});
it("keeps a zero liquidation price available without inventing a crossing", () => {
  const p = snapshot();
  p.balance!.allocatedBalance = 200n * W;
  expect(calculatePositionLiquidationState(p)).toMatchObject({
    status: "ready",
    liquidationPrice: 0n,
    isAtRisk: false,
  });
});
it.each([0n, -W])("rejects invalid mark %s", (price) => {
  const p = snapshot();
  p.mark!.price = price;
  expect(calculatePositionLiquidationState(p).status).toBe("unknown");
});
it("rejects missing positions, duplicate IDs and books from another VA", () => {
  const p = snapshot();
  expect(calculatePositionLiquidationState({ ...p, positions: [] }).status).toBe("unknown");
  expect(calculatePositionLiquidationState({ ...p, positions: [...p.positions, ...p.positions] }).status).toBe(
    "unknown",
  );
  expect(
    calculatePositionLiquidationState({ ...p, account: "0x0000000000000000000000000000000000000002" }).status,
  ).toBe("unknown");
});
