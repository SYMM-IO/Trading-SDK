import { describe, expect, it } from "vitest";
import { PositionType } from "../../symmio-contracts/symmio/types";
import { calculateQuoteUpnlWei } from "./calculate-quote-upnl-wei";

const ONE = 10n ** 18n;

describe("calculateQuoteUpnlWei", () => {
  it("credits a LONG when mark is above the open price", () => {
    // 2 × (110 − 100) = 20
    expect(
      calculateQuoteUpnlWei({
        positionType: PositionType.LONG,
        openQuantity: 2n * ONE,
        openedPrice: 100n * ONE,
        markPrice: 110n * ONE,
      }),
    ).toBe(20n * ONE);
  });

  it("debits a SHORT when mark is above the open price", () => {
    // −(3 × (110 − 100)) = −30
    expect(
      calculateQuoteUpnlWei({
        positionType: PositionType.SHORT,
        openQuantity: 3n * ONE,
        openedPrice: 100n * ONE,
        markPrice: 110n * ONE,
      }),
    ).toBe(-30n * ONE);
  });

  it("returns zero at the open price", () => {
    expect(
      calculateQuoteUpnlWei({
        positionType: PositionType.LONG,
        openQuantity: 5n * ONE,
        openedPrice: 100n * ONE,
        markPrice: 100n * ONE,
      }),
    ).toBe(0n);
  });
});
