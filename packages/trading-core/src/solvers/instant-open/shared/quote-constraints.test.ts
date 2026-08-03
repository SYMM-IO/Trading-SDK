import { describe, expect, it } from "vitest";
import { validateInstantOpenAgainstMarket } from "./quote-constraints";

/** A candidate quote: locked sum 6 (1+2+3), quantity 0.3, notional 30 at mark 100. */
const CANDIDATE = { quantity: "0.3", markPrice: "100", cva: "1", lf: "2", partyAmm: "3" };

describe("validateInstantOpenAgainstMarket", () => {
  it("fires every published constraint from a normalized market — the useMarkets row", () => {
    const { ok, violations } = validateInstantOpenAgainstMarket({
      ...CANDIDATE,
      market: {
        minAcceptablePortionLf: "0.5", // actual 2/6 ≈ 0.33 → violation
        minAcceptableQuoteValue: "10", // locked 6 → violation
        minNotionalValue: "50", // notional 30 → violation
        lotSize: "0.2", // 0.3 not a multiple → violation
      },
    });
    expect(ok).toBe(false);
    expect(violations.map((violation) => violation.kind).sort()).toEqual([
      "LF_PORTION_TOO_LOW",
      "NOTIONAL_TOO_LOW",
      "QUANTITY_NOT_LOT_MULTIPLE",
      "QUOTE_VALUE_TOO_LOW",
    ]);
  });

  it("passes a compliant quote and skips unpublished constraints", () => {
    const { ok, violations } = validateInstantOpenAgainstMarket({
      quantity: "0.4",
      markPrice: "100",
      cva: "10",
      lf: "10",
      partyAmm: "10",
      market: { minAcceptableQuoteValue: "10", lotSize: "0.2" },
    });
    expect(ok).toBe(true);
    expect(violations).toEqual([]);
  });

  it("treats the adapters' zero sentinels as unpublished caps, not zero caps", () => {
    // Adapters default missing vendor fields to 0/"0"; a literal zero cap would
    // otherwise flag every trade as NOTIONAL_TOO_HIGH / QUANTITY_TOO_HIGH.
    const { ok, violations } = validateInstantOpenAgainstMarket({
      ...CANDIDATE,
      market: { maxNotionalValue: 0, maxQuantity: "0", minNotionalValue: "0", lotSize: "0" },
    });
    expect(ok).toBe(true);
    expect(violations).toEqual([]);
  });
});
