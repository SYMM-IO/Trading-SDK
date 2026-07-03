import { describe, expect, it } from "vitest";
import { PositionType } from "../../symmio-contracts/symmio/types";
import { calculateQuoteUpnl } from "./calculate-quote-upnl";

const ONE = 10n ** 18n;

describe("calculateQuoteUpnl", () => {
  it("computes LONG upnl: openQty × (mark − open) × +1", () => {
    const { upnl, upnlPercent } = calculateQuoteUpnl({
      markPrice: "0.09",
      positionType: PositionType.LONG,
      quantity: 100n * ONE,
      closedAmount: 0n,
      openedPrice: 80_000_000_000_000_000n, // 0.08
      leverage: "10",
    });
    // openQty=100, delta=0.01, upnl = 100 * 0.01 = 1
    expect(Number(upnl)).toBeCloseTo(1, 9);
    // percent = 1 / 100 / 0.08 * 10 * 100 = 125
    expect(upnlPercent).toBe("125.00");
  });

  it("computes SHORT upnl: openQty × (mark − open) × -1", () => {
    const { upnl } = calculateQuoteUpnl({
      markPrice: "0.07",
      positionType: PositionType.SHORT,
      quantity: 100n * ONE,
      closedAmount: 0n,
      openedPrice: 80_000_000_000_000_000n,
      leverage: "10",
    });
    // delta = -0.01, * -1 = +0.01, * 100 = 1
    expect(Number(upnl)).toBeCloseTo(1, 9);
  });

  it("subtracts closedAmount from quantity for openQty", () => {
    const { upnl } = calculateQuoteUpnl({
      markPrice: "0.09",
      positionType: PositionType.LONG,
      quantity: 100n * ONE,
      closedAmount: 40n * ONE,
      openedPrice: 80_000_000_000_000_000n,
      leverage: "10",
    });
    // openQty = 60, delta = 0.01, upnl = 0.6
    expect(Number(upnl)).toBeCloseTo(0.6, 9);
  });

  it("returns 0 when there is no open size left", () => {
    const result = calculateQuoteUpnl({
      markPrice: "0.09",
      positionType: PositionType.LONG,
      quantity: 100n * ONE,
      closedAmount: 100n * ONE,
      openedPrice: 80_000_000_000_000_000n,
      leverage: "10",
    });
    expect(result).toEqual({ upnl: "0", upnlPercent: "0" });
  });

  it("returns upnl but 0 percent when openedPrice is zero", () => {
    const { upnl, upnlPercent } = calculateQuoteUpnl({
      markPrice: "0.09",
      positionType: PositionType.LONG,
      quantity: 100n * ONE,
      closedAmount: 0n,
      openedPrice: 0n,
      leverage: "10",
    });
    expect(Number(upnl)).toBeCloseTo(9, 9);
    expect(upnlPercent).toBe("0");
  });
});
