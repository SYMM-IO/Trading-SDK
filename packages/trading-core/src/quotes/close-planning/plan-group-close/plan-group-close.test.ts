import { describe, expect, it } from "vitest";
import type { GroupCloseCandidate } from "../types";
import { planGroupClose } from "./plan-group-close";

const ONE = 10n ** 18n;

function candidate(overrides: Partial<GroupCloseCandidate> & { key: string }): GroupCloseCandidate {
  return {
    openQuantity: 1n * ONE,
    minRemainingQuantity: 0n,
    ...overrides,
  };
}

describe("planGroupClose", () => {
  it("fails with nothing-to-close for a non-positive target or empty group", () => {
    const quotes = [candidate({ key: "a" })];
    expect(planGroupClose(quotes, 0n)).toMatchObject({ feasible: false, reason: "nothing-to-close" });
    expect(planGroupClose([], 1n * ONE)).toMatchObject({
      feasible: false,
      reason: "nothing-to-close",
      totalOpen: 0n,
      closeableQuantity: 0n,
    });
  });

  it("fails with exceeds-open when the target is above the group's open size", () => {
    const quotes = [candidate({ key: "a", openQuantity: 3n * ONE })];
    expect(planGroupClose(quotes, 4n * ONE)).toEqual({
      feasible: false,
      reason: "exceeds-open",
      totalOpen: 3n * ONE,
      closeableQuantity: 3n * ONE,
    });
  });

  it("closes everything fully when the target equals the total open size", () => {
    const quotes = [
      candidate({ key: "a", openQuantity: 3n * ONE, minRemainingQuantity: ONE }),
      candidate({ key: "b", openQuantity: 2n * ONE, minRemainingQuantity: ONE }),
    ];
    const plan = planGroupClose(quotes, 5n * ONE);
    expect(plan).toEqual({
      feasible: true,
      allocations: [
        { key: "a", closeQuantity: 3n * ONE, kind: "full" },
        { key: "b", closeQuantity: 2n * ONE, kind: "full" },
      ],
    });
  });

  it("closes largest-first: full closes then one exact partial", () => {
    const quotes = [
      candidate({ key: "small", openQuantity: 2n * ONE }),
      candidate({ key: "big", openQuantity: 5n * ONE }),
      candidate({ key: "mid", openQuantity: 3n * ONE, minRemainingQuantity: ONE }),
    ];
    // 6 = big 5 (full) + mid 1 (partial, remainder 2 ≥ minRemain 1)
    const plan = planGroupClose(quotes, 6n * ONE);
    expect(plan).toEqual({
      feasible: true,
      allocations: [
        { key: "big", closeQuantity: 5n * ONE, kind: "full" },
        { key: "mid", closeQuantity: 1n * ONE, kind: "partial" },
      ],
    });
  });

  it("spills to the next quote when a partial would leave dust", () => {
    // User's canonical example: 3.0 with minRemain 0.4, target 2.8
    // → close 2.6 (cap) + spill 0.2 to the next quote.
    const quotes = [
      candidate({ key: "a", openQuantity: 3n * ONE, minRemainingQuantity: (4n * ONE) / 10n }),
      candidate({ key: "b", openQuantity: 1n * ONE, minRemainingQuantity: (4n * ONE) / 10n }),
    ];
    const plan = planGroupClose(quotes, (28n * ONE) / 10n);
    expect(plan).toEqual({
      feasible: true,
      allocations: [
        { key: "a", closeQuantity: (26n * ONE) / 10n, kind: "partial" },
        { key: "b", closeQuantity: (2n * ONE) / 10n, kind: "partial" },
      ],
    });
  });

  it("absorbs a spilled remainder as a full close when it covers the next quote exactly", () => {
    const quotes = [
      candidate({ key: "a", openQuantity: 3n * ONE, minRemainingQuantity: (4n * ONE) / 10n }),
      candidate({ key: "b", openQuantity: (2n * ONE) / 10n, minRemainingQuantity: (4n * ONE) / 10n }),
    ];
    // spill 0.2 === b's whole open size → full close despite cap ≤ 0
    const plan = planGroupClose(quotes, (28n * ONE) / 10n);
    expect(plan).toEqual({
      feasible: true,
      allocations: [
        { key: "a", closeQuantity: (26n * ONE) / 10n, kind: "partial" },
        { key: "b", closeQuantity: (2n * ONE) / 10n, kind: "full" },
      ],
    });
  });

  it("fails with dust-locked and reports the closeable amount when the spill dead-ends", () => {
    const quotes = [candidate({ key: "a", openQuantity: 3n * ONE, minRemainingQuantity: (4n * ONE) / 10n })];
    const plan = planGroupClose(quotes, (28n * ONE) / 10n);
    expect(plan).toEqual({
      feasible: false,
      reason: "dust-locked",
      totalOpen: 3n * ONE,
      closeableQuantity: (26n * ONE) / 10n,
    });
  });

  it("always consumes from the biggest quote down, whatever the input order", () => {
    const quotes = [
      candidate({ key: "small", openQuantity: 1n * ONE }),
      candidate({ key: "big", openQuantity: 10n * ONE }),
      candidate({ key: "mid", openQuantity: 4n * ONE }),
    ];
    // 12 = big 10 (full) + 2 partial from mid; small untouched
    const plan = planGroupClose(quotes, 12n * ONE);
    expect(plan).toEqual({
      feasible: true,
      allocations: [
        { key: "big", closeQuantity: 10n * ONE, kind: "full" },
        { key: "mid", closeQuantity: 2n * ONE, kind: "partial" },
      ],
    });
  });

  it("skips a full-close-only quote (cap ≤ 0) when the remaining amount cannot cover it fully", () => {
    const quotes = [
      // minRemain ≥ open ⇒ can only be closed fully; remaining 1.5 < 2 cannot.
      candidate({ key: "locked", openQuantity: 2n * ONE, minRemainingQuantity: 2n * ONE }),
      candidate({ key: "free", openQuantity: 3n * ONE }),
    ];
    const plan = planGroupClose(quotes, (15n * ONE) / 10n);
    expect(plan).toEqual({
      feasible: true,
      allocations: [{ key: "free", closeQuantity: (15n * ONE) / 10n, kind: "partial" }],
    });
  });

  it("is deterministic regardless of input order", () => {
    const a = candidate({ key: "a", openQuantity: 5n * ONE });
    const b = candidate({ key: "b", openQuantity: 3n * ONE });
    const c = candidate({ key: "c", openQuantity: 1n * ONE });
    const target = 4n * ONE;
    expect(planGroupClose([a, b, c], target)).toEqual(planGroupClose([c, b, a], target));
  });
});
