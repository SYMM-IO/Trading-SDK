import { describe, expect, it } from "vitest";
import { validateInstantCloseAgainstMarket, type InstantCloseConstraintFields } from "./quote-constraints";

/** A close that respects every constraint, so each test overrides just what it probes. */
function baseParams(market: InstantCloseConstraintFields) {
  return {
    market,
    originalQuantity: "1.0",
    closeQuantity: "1.0",
    cva: "60",
    lf: "20",
    partyAmm: "20",
  };
}

describe("validateInstantCloseAgainstMarket", () => {
  it("returns no violations for a market that publishes no constraints", () => {
    const result = validateInstantCloseAgainstMarket(baseParams({}));
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  /**
   * Regression: the validator reads the **normalized** camelCase spelling
   * (`lotSize`). The earlier snake_case read (`lot_size`) silently found
   * `undefined` on the camelCase market the app passes and skipped every check,
   * so a bad close sailed through. A camelCase market must now actually fire.
   */
  it("fires the lot-size checks on a camelCase market row", () => {
    const result = validateInstantCloseAgainstMarket({
      ...baseParams({ lotSize: "0.2" }),
      originalQuantity: "1.0",
      closeQuantity: "0.3", // 0.3 is ≥ 0.2 but not a multiple of it
    });
    expect(result.ok).toBe(false);
    // close leg (0.3) and remaining leg (0.7) both break the 0.2 multiple.
    expect(result.violations.map((v) => v.kind)).toEqual([
      "CLOSE_QUANTITY_NOT_LOT_MULTIPLE",
      "CLOSE_QUANTITY_NOT_LOT_MULTIPLE",
    ]);
    const sides = result.violations.map((v) =>
      v.kind === "CLOSE_QUANTITY_NOT_LOT_MULTIPLE" || v.kind === "CLOSE_QUANTITY_BELOW_LOT_SIZE" ? v.side : undefined,
    );
    expect(sides).toEqual(["close", "remaining"]);
  });

  it("flags a close quantity below the lot size", () => {
    const result = validateInstantCloseAgainstMarket({
      ...baseParams({ lotSize: "0.2" }),
      originalQuantity: "1.0",
      closeQuantity: "0.1",
    });
    expect(result.violations.some((v) => v.kind === "CLOSE_QUANTITY_BELOW_LOT_SIZE" && v.side === "close")).toBe(true);
  });

  it("flags remaining locked margin below the market minimum on a partial close", () => {
    const result = validateInstantCloseAgainstMarket({
      market: { minAcceptableQuoteValue: "100" },
      originalQuantity: "1.0",
      closeQuantity: "0.5", // remaining 0.5 → locked scales to 100 × 0.5 = 50 < 100
      cva: "60",
      lf: "20",
      partyAmm: "20",
    });
    expect(result.ok).toBe(false);
    const violation = result.violations.find((v) => v.kind === "REMAINING_LOCKED_BELOW_MIN_QUOTE_VALUE");
    expect(violation).toBeDefined();
    if (violation?.kind === "REMAINING_LOCKED_BELOW_MIN_QUOTE_VALUE") {
      expect(violation.remainingLockedSum).toBe("50");
      expect(violation.minQuoteValue).toBe("100");
    }
  });

  it("skips the min-quote-value check on a full close (no remaining)", () => {
    const result = validateInstantCloseAgainstMarket({
      market: { minAcceptableQuoteValue: "100" },
      originalQuantity: "1.0",
      closeQuantity: "1.0",
      cva: "60",
      lf: "20",
      partyAmm: "20",
    });
    expect(result.violations.some((v) => v.kind === "REMAINING_LOCKED_BELOW_MIN_QUOTE_VALUE")).toBe(false);
  });
});
