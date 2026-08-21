import { QuoteLifecycle, QuoteStatus, type UnifiedQuote } from "@symmio/trading-core";
import { describe, expect, it } from "vitest";
import {
  isCancelConfirmedOnchain,
  isCloseConfirmedOnchain,
  isOpenConfirmedOnchain,
  nextConfirmDelay,
  pruneCancelConfirmHold,
  pruneCloseConfirmHold,
  pruneOpenConfirmHold,
} from "./confirm-hold";

/** Minimal {@link UnifiedQuote} carrying only the fields the hold logic reads. */
function makeUnified(overrides: Partial<UnifiedQuote> = {}): UnifiedQuote {
  return {
    lifecycle: QuoteLifecycle.ONCHAIN,
    quantity: 10n,
    closedAmount: 0n,
    quoteId: 1n,
    raw: {},
    ...overrides,
  } as UnifiedQuote;
}

describe("isCloseConfirmedOnchain", () => {
  it("is false for an open row the chain has not closed", () => {
    expect(isCloseConfirmedOnchain(makeUnified({ lifecycle: QuoteLifecycle.ONCHAIN, closedAmount: 0n }))).toBe(false);
  });

  it("is false for a partial close (closedAmount below quantity)", () => {
    expect(isCloseConfirmedOnchain(makeUnified({ quantity: 10n, closedAmount: 5n }))).toBe(false);
  });

  it("is true once the status reflects the close (CLOSE_PENDING status / CLOSED lifecycle)", () => {
    expect(isCloseConfirmedOnchain(makeUnified({ quoteStatus: QuoteStatus.CLOSE_PENDING }))).toBe(true);
    expect(isCloseConfirmedOnchain(makeUnified({ quoteStatus: QuoteStatus.CANCEL_CLOSE_PENDING }))).toBe(true);
    expect(isCloseConfirmedOnchain(makeUnified({ lifecycle: QuoteLifecycle.CLOSED }))).toBe(true);
  });

  it("is true when closedAmount caught up to the full quantity", () => {
    expect(isCloseConfirmedOnchain(makeUnified({ quantity: 10n, closedAmount: 10n }))).toBe(true);
  });

  it("guards against a zero-quantity row reading as closed", () => {
    expect(isCloseConfirmedOnchain(makeUnified({ quantity: 0n, closedAmount: 0n }))).toBe(false);
  });
});

describe("nextConfirmDelay", () => {
  it("doubles from the first delay and caps at the max (500 → 1s → 2s → … → 60s)", () => {
    const max = 60_000;
    const schedule: number[] = [];
    let delay = 500;
    for (let i = 0; i < 9; i++) {
      delay = nextConfirmDelay(delay, max);
      schedule.push(delay);
    }
    expect(schedule).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000, 60_000]);
  });

  it("never exceeds the cap even from a large current value", () => {
    expect(nextConfirmDelay(59_000, 60_000)).toBe(60_000);
    expect(nextConfirmDelay(60_000, 60_000)).toBe(60_000);
  });
});

describe("pruneCloseConfirmHold", () => {
  it("returns [] and does nothing for an empty hold", () => {
    const pending = new Map<string, number>();
    expect(pruneCloseConfirmHold(pending, [], 1_000)).toEqual([]);
    expect(pending.size).toBe(0);
  });

  it("keeps an entry whose quote is still open and before its deadline (the rasa lag window)", () => {
    const pending = new Map<string, number>([["1", 5_000]]);
    const quotes = [makeUnified({ quoteId: 1n, lifecycle: QuoteLifecycle.ONCHAIN, closedAmount: 0n })];
    expect(pruneCloseConfirmHold(pending, quotes, 1_000)).toEqual([]);
    expect(pending.has("1")).toBe(true);
  });

  it("releases an entry once its quote drops out of the active set (full close)", () => {
    const pending = new Map<string, number>([["2", 5_000]]);
    expect(pruneCloseConfirmHold(pending, [], 1_000)).toEqual([]);
    expect(pending.has("2")).toBe(false);
  });

  it("releases an entry once the chain confirms the close on a still-present row", () => {
    const pending = new Map<string, number>([["1", 5_000]]);
    const quotes = [makeUnified({ quoteId: 1n, quantity: 10n, closedAmount: 10n })];
    expect(pruneCloseConfirmHold(pending, quotes, 1_000)).toEqual([]);
    expect(pending.has("1")).toBe(false);
  });

  it("reports an entry that hit its deadline without confirmation", () => {
    const pending = new Map<string, number>([["1", 500]]);
    const quotes = [makeUnified({ quoteId: 1n, lifecycle: QuoteLifecycle.ONCHAIN, closedAmount: 0n })];
    expect(pruneCloseConfirmHold(pending, quotes, 1_000)).toEqual(["1"]);
    expect(pending.has("1")).toBe(false);
  });

  it("handles a mixed hold: keep the live one, drop the confirmed, report the expired", () => {
    const pending = new Map<string, number>([
      ["1", 5_000], // still open, before deadline → kept
      ["2", 5_000], // absent from quotes → released
      ["3", 200], // still open, past deadline → reported
    ]);
    const quotes = [
      makeUnified({ quoteId: 1n, lifecycle: QuoteLifecycle.ONCHAIN, closedAmount: 0n }),
      makeUnified({ quoteId: 3n, lifecycle: QuoteLifecycle.ONCHAIN, closedAmount: 0n }),
    ];
    expect(pruneCloseConfirmHold(pending, quotes, 1_000)).toEqual(["3"]);
    expect([...pending.keys()]).toEqual(["1"]);
  });
});

describe("isOpenConfirmedOnchain", () => {
  it("is false for a row that only a notification anchored (no polled struct yet)", () => {
    expect(isOpenConfirmedOnchain(makeUnified({ lifecycle: QuoteLifecycle.WRITE_ONCHAIN, raw: {} }))).toBe(false);
  });

  it("is true once the row carries the polled on-chain struct", () => {
    expect(isOpenConfirmedOnchain(makeUnified({ raw: { onchain: {} as never } }))).toBe(true);
  });
});

describe("pruneOpenConfirmHold", () => {
  it("returns [] and does nothing for an empty hold", () => {
    const pending = new Map<string, number>();
    expect(pruneOpenConfirmHold(pending, [], 1_000)).toEqual([]);
    expect(pending.size).toBe(0);
  });

  it("keeps an entry whose quote the read has not returned yet — absence is what it chases", () => {
    const pending = new Map<string, number>([["1", 5_000]]);
    expect(pruneOpenConfirmHold(pending, [], 1_000)).toEqual([]);
    expect(pending.has("1")).toBe(true);
  });

  it("keeps an entry whose row is present but still awaiting the RPC (WRITE_ONCHAIN)", () => {
    const pending = new Map<string, number>([["1", 5_000]]);
    const quotes = [makeUnified({ quoteId: 1n, lifecycle: QuoteLifecycle.WRITE_ONCHAIN, raw: {} })];
    expect(pruneOpenConfirmHold(pending, quotes, 1_000)).toEqual([]);
    expect(pending.has("1")).toBe(true);
  });

  it("releases an entry once the on-chain read returns the quote", () => {
    const pending = new Map<string, number>([["1", 5_000]]);
    const quotes = [makeUnified({ quoteId: 1n, raw: { onchain: {} as never } })];
    expect(pruneOpenConfirmHold(pending, quotes, 1_000)).toEqual([]);
    expect(pending.has("1")).toBe(false);
  });

  it("reports an entry that hit its deadline without the read ever confirming it", () => {
    const pending = new Map<string, number>([["1", 500]]);
    expect(pruneOpenConfirmHold(pending, [], 1_000)).toEqual(["1"]);
    expect(pending.has("1")).toBe(false);
  });

  it("handles a mixed hold: keep the unread one, drop the confirmed, report the expired", () => {
    const pending = new Map<string, number>([
      ["1", 5_000], // not read back yet, before deadline → kept
      ["2", 5_000], // polled struct present → released
      ["3", 200], // not read back, past deadline → reported
    ]);
    const quotes = [makeUnified({ quoteId: 2n, raw: { onchain: {} as never } })];
    expect(pruneOpenConfirmHold(pending, quotes, 1_000)).toEqual(["3"]);
    expect([...pending.keys()]).toEqual(["1"]);
  });
});

describe("isCancelConfirmedOnchain", () => {
  it("is false while the quote is still cancel-pending", () => {
    expect(isCancelConfirmedOnchain(makeUnified({ quoteStatus: QuoteStatus.CANCEL_PENDING }))).toBe(false);
  });

  it("is false for a still-locked read — the pre-request snapshot must not end the chase", () => {
    expect(isCancelConfirmedOnchain(makeUnified({ quoteStatus: QuoteStatus.LOCKED }))).toBe(false);
  });

  it("is true once the row went terminal", () => {
    expect(isCancelConfirmedOnchain(makeUnified({ lifecycle: QuoteLifecycle.CLOSED }))).toBe(true);
  });
});

describe("pruneCancelConfirmHold", () => {
  it("releases a hold whose quote left the active set (the solver accepted the cancel)", () => {
    const pending = new Map([["1", 1_000]]);
    expect(pruneCancelConfirmHold(pending, [], 0)).toEqual([]);
    expect(pending.size).toBe(0);
  });

  it("releases a hold whose quote went terminal", () => {
    const pending = new Map([["1", 1_000]]);
    const row = makeUnified({ quoteId: 1n, lifecycle: QuoteLifecycle.CLOSED });
    expect(pruneCancelConfirmHold(pending, [row], 0)).toEqual([]);
    expect(pending.size).toBe(0);
  });

  it("keeps holding through LOCKED and CANCEL_PENDING", () => {
    const pending = new Map([["1", 1_000]]);
    const locked = makeUnified({ quoteId: 1n, quoteStatus: QuoteStatus.LOCKED });
    expect(pruneCancelConfirmHold(pending, [locked], 0)).toEqual([]);
    expect(pending.size).toBe(1);

    const cancelPending = makeUnified({ quoteId: 1n, quoteStatus: QuoteStatus.CANCEL_PENDING });
    expect(pruneCancelConfirmHold(pending, [cancelPending], 0)).toEqual([]);
    expect(pending.size).toBe(1);
  });

  it("reports a hold dropped because its deadline passed without an answer", () => {
    const pending = new Map([["1", 1_000]]);
    const row = makeUnified({ quoteId: 1n, quoteStatus: QuoteStatus.CANCEL_PENDING });
    expect(pruneCancelConfirmHold(pending, [row], 2_000)).toEqual(["1"]);
    expect(pending.size).toBe(0);
  });

  it("is a no-op on an empty map", () => {
    const pending = new Map<string, number>();
    expect(pruneCancelConfirmHold(pending, [], 0)).toEqual([]);
  });
});
