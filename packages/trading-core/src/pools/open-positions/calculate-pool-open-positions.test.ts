import { describe, expect, expectTypeOf, it } from "vitest";
import type { AccountBalanceInfo } from "../../symmio-contracts/account-layer/types";
import type { PoolQuote } from "../types";
import { calculatePoolOpenPositions, type CalculatePoolOpenPositionsParameters } from "./calculate-pool-open-positions";
const wei = 10n ** 18n;
const quote = {
  id: "q",
  partyA: "0xABC",
  quantity: 4n * wei,
  closedAmount: wei,
  openedPrice: 2n * wei,
  positionType: 0,
  symbolId: 1,
  leverage: 2n * wei,
  initialCva: 0n,
  initialLf: 0n,
  initialPartyAmm: 4n * wei,
} as PoolQuote;
const balance = {
  allocatedBalance: 3n * wei,
  lockedCVA: 0n,
  lockedLF: 0n,
  pendingLockedCVA: wei,
  pendingLockedLF: wei,
} as AccountBalanceInfo;
describe("composed open positions", () => {
  it.each([0, 1])("values an explicit zero mark for side %s", (positionType) => {
    expect(
      calculatePoolOpenPositions({ quotes: [{ ...quote, positionType }], balances: {}, priceUsd: 0 }).entries[0],
    ).toMatchObject({
      positionValueUsd: 0,
      upnlUsd: positionType === 0 ? -6 : 6,
      priceChangePercent: positionType === 0 ? -100 : 100,
    });
  });
  it("does not invent a side for a partial quote", () => {
    const partial = { ...quote, positionType: undefined };
    expect(
      calculatePoolOpenPositions({
        quotes: [partial],
        balances: { "0xabc": balance },
        priceUsd: 3,
        allowQuoteLockEstimate: true,
      }).entries[0],
    ).toMatchObject({
      positionValueUsd: 9,
      upnlUsd: null,
      priceChangePercent: null,
      liquidationPrice: null,
      liquidationSource: null,
    });
  });
  it("preserves fractional notional percentages before presentation rounding", () => {
    const row = calculatePoolOpenPositions({
      quotes: [{ ...quote, openedPrice: 2800000000000000n }],
      balances: {},
      priceUsd: 0.0027,
    }).entries[0]!;
    expect(row.priceChangePercent).toBeCloseTo(-3.57142857142857, 10);
  });
  it("labels opt-in lock estimates and retains live account precedence", () => {
    const sources = { quotes: [quote], balances: {}, allowQuoteLockEstimate: true };
    expect(calculatePoolOpenPositions(sources).entries[0]).toMatchObject({
      liquidationPrice: wei,
      liquidationSource: "quote-lock",
      entryValueUsd: 6,
    });
    expect(calculatePoolOpenPositions({ ...sources, balances: { "0xabc": balance } }).entries[0]).toMatchObject({
      liquidationPrice: (5n * wei) / 3n,
      liquidationSource: "account",
    });
    expect(
      calculatePoolOpenPositions({ ...sources, quotes: [{ ...quote, positionType: 1 }] }).entries[0]?.liquidationPrice,
    ).toBe(3n * wei);
    expect(
      calculatePoolOpenPositions({ ...sources, quotes: [{ ...quote, initialPartyAmm: 0n }] }).entries[0]
        ?.liquidationPrice,
    ).toBe(wei);
    expect(
      calculatePoolOpenPositions({ quotes: [{ timestamp: 123 }], balances: {}, allowQuoteLockEstimate: true })
        .entries[0],
    ).toMatchObject({ liquidationPrice: null, liquidationSource: null, openedAt: 123, remainingQuantity: null });
  });
  it("retains the pool table's leverage inference and timestamp precedence", () => {
    const row = calculatePoolOpenPositions({
      quotes: [
        {
          ...quote,
          leverage: null,
          initialLf: wei,
          initialPartyAmm: 9n * wei,
          timestampOpenPosition: 0,
          timestampSendQuote: 123,
        },
      ],
      balances: {},
    }).entries[0]!;
    expect(row.leverageMultiplier).toBe(10);
    expect(row.openedAt).toBe(123);
    const fallback = calculatePoolOpenPositions({
      quotes: [{ ...quote, leverage: null, openedPrice: (21n * wei) / 10n, requestedOpenPrice: 2n * wei }],
      balances: {},
    }).entries[0]!;
    expect(fallback.leverageMultiplier).toBe(2);
  });
  it("accepts normalized bigint quotes and preserves the unleveraged table percentage", () => {
    expectTypeOf<readonly PoolQuote[]>().toExtend<CalculatePoolOpenPositionsParameters["quotes"]>();
    expectTypeOf<Readonly<Record<string, AccountBalanceInfo | null>>>().toExtend<
      CalculatePoolOpenPositionsParameters["balances"]
    >();
    const row = calculatePoolOpenPositions({ quotes: [quote], balances: { "0xabc": balance }, priceUsd: 2.5 })
      .entries[0]!;
    expect(row.remainingQuantity).toBe(3n * wei);
    expect(row.upnlUsd).toBe(1.5);
    expect(row.priceChangePercent).toBe(25);
    expect(row.leverageMultiplier).toBe(2);
    expect(row.liquidationPrice).toBe((5n * wei) / 3n);
  });
  it("does not invent prices when a mark or balance read is absent", () => {
    expect(calculatePoolOpenPositions({ quotes: [quote], balances: {} }).entries[0]).toMatchObject({
      upnlUsd: null,
      positionValueUsd: null,
      liquidationPrice: null,
      priceChangePercent: null,
    });
  });
  it("does not estimate liquidation from partial or mixed-side accounts", () => {
    expect(
      calculatePoolOpenPositions({ quotes: [quote], balances: { "0xabc": balance }, complete: false }).entries[0]
        ?.liquidationPrice,
    ).toBeNull();
    expect(
      calculatePoolOpenPositions({
        quotes: [quote, { ...quote, id: "short", positionType: 1 }],
        balances: { "0xabc": balance },
      }).entries[0]?.liquidationPrice,
    ).toBeNull();
  });
});
