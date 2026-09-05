import { describe, expect, it } from "vitest";
import { makeUnifiedQuote } from "../unified-quote.test";
import { minRemainingQuantityOf } from "./min-remaining-quantity";

const ONE = 10n ** 18n;

describe("minRemainingQuantityOf", () => {
  it("scales the value floor to a size floor via the partyA-locked value", () => {
    // open 10, lockedForPartyA 100 (40 cva + 20 lf + 40 partyAmm), MAQV 20
    // → remaining ≥ 10 × 20 / 100 = 2
    const quote = makeUnifiedQuote({
      quantity: 10n * ONE,
      closedAmount: 0n,
      lockedValues: { cva: 40n * ONE, lf: 20n * ONE, partyAmm: 40n * ONE, partyBmm: 0n },
    });
    expect(minRemainingQuantityOf(quote, 20n * ONE)).toBe(2n * ONE);
  });

  it("rounds up so a one-wei-short remainder cannot slip through", () => {
    // open 10, lockedForPartyA 3, MAQV 1 → 10/3 = 3.33… → ceil
    const quote = makeUnifiedQuote({
      quantity: 10n,
      closedAmount: 0n,
      openQuantity: 10n,
      lockedValues: { cva: 3n, lf: 0n, partyAmm: 0n, partyBmm: 0n },
    });
    expect(minRemainingQuantityOf(quote, 1n)).toBe(4n);
  });

  it("excludes partyBmm from the locked basis", () => {
    const withoutB = makeUnifiedQuote({
      quantity: 10n * ONE,
      closedAmount: 0n,
      lockedValues: { cva: 50n * ONE, lf: 0n, partyAmm: 0n, partyBmm: 0n },
    });
    const withB = makeUnifiedQuote({
      quantity: 10n * ONE,
      closedAmount: 0n,
      lockedValues: { cva: 50n * ONE, lf: 0n, partyAmm: 0n, partyBmm: 999n * ONE },
    });
    expect(minRemainingQuantityOf(withB, 10n * ONE)).toBe(minRemainingQuantityOf(withoutB, 10n * ONE));
  });

  it("returns the full open quantity (full-close-only) when nothing is locked for partyA", () => {
    const quote = makeUnifiedQuote({
      quantity: 5n * ONE,
      closedAmount: 0n,
      lockedValues: { cva: 0n, lf: 0n, partyAmm: 0n, partyBmm: 1n * ONE },
    });
    expect(minRemainingQuantityOf(quote, 10n * ONE)).toBe(5n * ONE);
  });
});
