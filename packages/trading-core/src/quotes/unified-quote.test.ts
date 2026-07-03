import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { OrderType, PositionType, QuoteStatus, type LockedValues } from "../symmio-contracts/symmio/types";
import { QuoteLifecycle, type UnifiedQuote } from "./unified-quote";

/** Deterministic test sub-account (partyA). Public, never used on a real chain. */
export const TEST_SUB_ACCOUNT: Address = "0x1111111111111111111111111111111111111111";
/** Deterministic test Virtual Account address. */
export const TEST_VA: Address = "0x2222222222222222222222222222222222222222";

/** All-zero locked values for off-chain fixtures. */
const ZERO_LOCKED: LockedValues = { cva: 0n, lf: 0n, partyAmm: 0n, partyBmm: 0n };

/**
 * Build a {@link UnifiedQuote} for tests. Defaults to an on-chain `OPENED` long
 * market position; pass `overrides` to vary any field. When `openQuantity` is not
 * overridden it is derived from the final `quantity − closedAmount`, so tests can
 * set just `quantity`/`closedAmount` and get a consistent open size.
 *
 * @param overrides - Fields to override on the default quote.
 * @returns A fully-populated unified quote.
 */
export function makeUnifiedQuote(overrides: Partial<UnifiedQuote> = {}): UnifiedQuote {
  const base: UnifiedQuote = {
    key: "onchain:1",
    origin: "onchain",
    lifecycle: QuoteLifecycle.ONCHAIN,
    quoteId: 1n,
    partyA: TEST_SUB_ACCOUNT,
    vaAddress: TEST_VA,
    symbolId: 1n,
    positionType: PositionType.LONG,
    orderType: OrderType.MARKET,
    quoteStatus: QuoteStatus.OPENED,
    requestedOpenPrice: 2_000_000000000000000000n,
    openedPrice: 2_000_000000000000000000n,
    quantity: 1_000000000000000000n,
    closedAmount: 0n,
    openQuantity: 1_000000000000000000n,
    lockedValues: { cva: 10_000000000000000000n, lf: 2_000000000000000000n, partyAmm: 0n, partyBmm: 0n },
    createTimestamp: 1_000n,
    statusModifyTimestamp: 1_000n,
    raw: {},
  };
  const merged: UnifiedQuote = { ...base, ...overrides };
  if (overrides.openQuantity === undefined) {
    merged.openQuantity = merged.quantity - (merged.closedAmount ?? 0n);
  }
  return merged;
}

/**
 * Build an optimistic off-chain {@link UnifiedQuote} (a pending instant-open):
 * no on-chain id/status, `OPTIMISTIC` lifecycle, zeroed locked values, keyed by
 * `temp:<tempQuoteId>`.
 *
 * @param overrides - Fields to override on the default optimistic quote.
 * @returns A unified quote in the optimistic stage.
 */
export function makeOptimisticQuote(overrides: Partial<UnifiedQuote> = {}): UnifiedQuote {
  return makeUnifiedQuote({
    key: `temp:${overrides.tempQuoteId ?? 1}`,
    origin: "offchain",
    lifecycle: QuoteLifecycle.OPTIMISTIC,
    quoteId: undefined,
    tempQuoteId: 1,
    quoteStatus: undefined,
    vaAddress: undefined,
    openedPrice: undefined,
    /** A brand-new optimistic open has no on-chain timestamps yet. */
    createTimestamp: undefined,
    statusModifyTimestamp: undefined,
    lockedValues: ZERO_LOCKED,
    ...overrides,
  });
}

describe("makeUnifiedQuote / makeOptimisticQuote fixtures", () => {
  it("defaults to an anchored on-chain OPENED long with derived open quantity", () => {
    const quote = makeUnifiedQuote({ quantity: 5n, closedAmount: 2n });
    expect(quote.origin).toBe("onchain");
    expect(quote.quoteStatus).toBe(QuoteStatus.OPENED);
    expect(quote.openQuantity).toBe(3n);
  });

  it("builds a timestamp-less optimistic off-chain open", () => {
    const quote = makeOptimisticQuote({ tempQuoteId: 7 });
    expect(quote.origin).toBe("offchain");
    expect(quote.lifecycle).toBe(QuoteLifecycle.OPTIMISTIC);
    expect(quote.key).toBe("temp:7");
    expect(quote.quoteId).toBeUndefined();
    expect(quote.statusModifyTimestamp).toBeUndefined();
  });
});
