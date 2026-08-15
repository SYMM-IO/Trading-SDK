import { QuoteLifecycle, type UnifiedQuote } from "@symmio/trading-core";
import { describe, expect, it } from "vitest";
import { isCloseConfirmedOnchain, nextCloseConfirmDelay, pruneCloseConfirmHold } from "./close-confirm-hold";

/** Minimal {@link UnifiedQuote} carrying only the fields the hold logic reads. */
function makeUnified(overrides: Partial<UnifiedQuote> = {}): UnifiedQuote {
  return {
    lifecycle: QuoteLifecycle.ONCHAIN,
    quantity: 10n,
    closedAmount: 0n,
    quoteId: 1n,
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

  it("is true once the status reflects the close (CLOSING / CLOSED)", () => {
    expect(isCloseConfirmedOnchain(makeUnified({ lifecycle: QuoteLifecycle.CLOSING }))).toBe(true);
    expect(isCloseConfirmedOnchain(makeUnified({ lifecycle: QuoteLifecycle.CLOSED }))).toBe(true);
  });

  it("is true when closedAmount caught up to the full quantity", () => {
    expect(isCloseConfirmedOnchain(makeUnified({ quantity: 10n, closedAmount: 10n }))).toBe(true);
  });

  it("guards against a zero-quantity row reading as closed", () => {
    expect(isCloseConfirmedOnchain(makeUnified({ quantity: 0n, closedAmount: 0n }))).toBe(false);
  });
});

describe("nextCloseConfirmDelay", () => {
  it("doubles from the first delay and caps at the max (500 → 1s → 2s → … → 60s)", () => {
    const max = 60_000;
    const schedule: number[] = [];
    let delay = 500;
    for (let i = 0; i < 9; i++) {
      delay = nextCloseConfirmDelay(delay, max);
      schedule.push(delay);
    }
    expect(schedule).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 32_000, 60_000, 60_000, 60_000]);
  });

  it("never exceeds the cap even from a large current value", () => {
    expect(nextCloseConfirmDelay(59_000, 60_000)).toBe(60_000);
    expect(nextCloseConfirmDelay(60_000, 60_000)).toBe(60_000);
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
