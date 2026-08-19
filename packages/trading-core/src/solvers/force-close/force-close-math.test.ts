import { describe, expect, it } from "vitest";
import type { Candle } from "../../candles/types";
import { OrderType, PositionType, QuoteStatus, type Quote } from "../../symmio-contracts/symmio/types";
import {
  checkForceCloseEligibility,
  checkForceClosePriceReached,
  findForceCloseWindow,
  previewForceClosePrice,
} from "./force-close-math";

const WAD = 10n ** 18n;

function eligQuote(overrides: Partial<Quote> = {}) {
  return {
    quoteStatus: QuoteStatus.CLOSE_PENDING,
    orderType: OrderType.LIMIT,
    statusModifyTimestamp: 1_000n,
    deadline: 100_000n,
    ...overrides,
  } as Quote;
}

describe("checkForceCloseEligibility", () => {
  const firstCooldown = 60n;
  const secondCooldown = 30n;
  const minSigPeriod = 10n;
  // readyAt = statusModifyTimestamp(1000) + 60 + 30 + 10 = 1100

  it("blocks when the quote is not CLOSE_PENDING", () => {
    const r = checkForceCloseEligibility({
      quote: eligQuote({ quoteStatus: QuoteStatus.OPENED }),
      firstCooldown,
      secondCooldown,
      minSigPeriod,
      now: 2_000n,
    });
    expect(r).toEqual({ eligible: false, reason: "not-close-pending", cooldownRemaining: 0n });
  });

  it("blocks when the order type is not LIMIT", () => {
    const r = checkForceCloseEligibility({
      quote: eligQuote({ orderType: OrderType.MARKET }),
      firstCooldown,
      secondCooldown,
      minSigPeriod,
      now: 2_000n,
    });
    expect(r.reason).toBe("not-limit");
  });

  it("blocks until a valid signature window exists (firstCooldown + secondCooldown + minSigPeriod)", () => {
    // readyAt = 1100; now = 1070 → 30s left. (Past firstCooldown at 1060 but window still empty.)
    const r = checkForceCloseEligibility({
      quote: eligQuote(),
      firstCooldown,
      secondCooldown,
      minSigPeriod,
      now: 1_070n,
    });
    expect(r).toEqual({ eligible: false, reason: "cooldown", cooldownRemaining: 30n });
  });

  it("blocks as expired within the second cooldown of the deadline", () => {
    // deadline - secondCooldown = 100000 - 30 = 99970; now >= 99970 → expired
    const r = checkForceCloseEligibility({
      quote: eligQuote(),
      firstCooldown,
      secondCooldown,
      minSigPeriod,
      now: 99_980n,
    });
    expect(r.reason).toBe("expired");
  });

  it("is eligible once a valid window exists and before expiry", () => {
    const r = checkForceCloseEligibility({
      quote: eligQuote(),
      firstCooldown,
      secondCooldown,
      minSigPeriod,
      now: 2_000n,
    });
    expect(r).toEqual({ eligible: true, cooldownRemaining: 0n });
  });
});

function candle(timeSec: number, high: number, low: number): Candle {
  return { time: timeSec * 1000, open: 0, high, low, close: 0, volume: 0 };
}

describe("findForceCloseWindow", () => {
  const base = {
    gapRatio: 0n, // no gap → threshold == requested price
    firstCooldown: 60n,
    secondCooldown: 30n,
    now: 10_000n,
    intervalMs: 60_000,
  };
  // window: [statusModifyTimestamp + 60, now - 30] = [1060, 9970]

  it("returns the first in-window candle whose high reaches a LONG's price", () => {
    const quote = {
      positionType: PositionType.LONG,
      requestedClosePrice: 100n * WAD,
      statusModifyTimestamp: 1_000n,
    } as Quote;
    const candles = [
      candle(2_000, 90, 80), // in window, high 90 < 100 → no
      candle(3_000, 105, 95), // in window, high 105 >= 100 → match, close = 3060
    ];
    expect(findForceCloseWindow({ quote, candles, ...base })).toEqual({ t0: 3_000n, t1: 3_060n });
  });

  it("returns the first candle whose low reaches a SHORT's price", () => {
    const quote = {
      positionType: PositionType.SHORT,
      requestedClosePrice: 100n * WAD,
      statusModifyTimestamp: 1_000n,
    } as Quote;
    const candles = [candle(3_000, 120, 95)]; // low 95 <= 100 → match
    expect(findForceCloseWindow({ quote, candles, ...base })).toEqual({ t0: 3_000n, t1: 3_060n });
  });

  it("skips candles outside the cooldown window", () => {
    const quote = {
      positionType: PositionType.LONG,
      requestedClosePrice: 100n * WAD,
      statusModifyTimestamp: 1_000n,
    } as Quote;
    const candles = [
      candle(500, 200, 200), // before window start (1060) → skip despite reaching
      candle(9_950, 200, 200), // close = 10010 > 9970 → skip
    ];
    expect(findForceCloseWindow({ quote, candles, ...base })).toBeNull();
  });

  it("returns null when no candle reaches the price", () => {
    const quote = {
      positionType: PositionType.LONG,
      requestedClosePrice: 100n * WAD,
      statusModifyTimestamp: 1_000n,
    } as Quote;
    expect(findForceCloseWindow({ quote, candles: [candle(3_000, 90, 80)], ...base })).toBeNull();
  });
});

describe("checkForceClosePriceReached", () => {
  const gapRatio = 5n * 10n ** 16n; // 5%
  const R = 100n * WAD;

  it("LONG: true when highest ≥ R*(1+gap)", () => {
    expect(
      checkForceClosePriceReached({
        sig: { highest: 105n * WAD, lowest: 0n },
        positionType: PositionType.LONG,
        requestedClosePrice: R,
        gapRatio,
      }),
    ).toBe(true);
    expect(
      checkForceClosePriceReached({
        sig: { highest: 104n * WAD, lowest: 0n },
        positionType: PositionType.LONG,
        requestedClosePrice: R,
        gapRatio,
      }),
    ).toBe(false);
  });

  it("SHORT: true when lowest ≤ R*(1-gap)", () => {
    expect(
      checkForceClosePriceReached({
        sig: { highest: 0n, lowest: 95n * WAD },
        positionType: PositionType.SHORT,
        requestedClosePrice: R,
        gapRatio,
      }),
    ).toBe(true);
    expect(
      checkForceClosePriceReached({
        sig: { highest: 0n, lowest: 96n * WAD },
        positionType: PositionType.SHORT,
        requestedClosePrice: R,
        gapRatio,
      }),
    ).toBe(false);
  });
});

describe("previewForceClosePrice", () => {
  const pen = 2n * 10n ** 16n; // 2%
  const R = 100n * WAD;

  it("LONG: max(R*(1+pen), averagePrice)", () => {
    expect(
      previewForceClosePrice({
        sig: { averagePrice: 110n * WAD },
        positionType: PositionType.LONG,
        requestedClosePrice: R,
        pricePenalty: pen,
      }),
    ).toBe(110n * WAD);
    expect(
      previewForceClosePrice({
        sig: { averagePrice: 100n * WAD },
        positionType: PositionType.LONG,
        requestedClosePrice: R,
        pricePenalty: pen,
      }),
    ).toBe(102n * WAD);
  });

  it("SHORT: min(R*(1-pen), averagePrice)", () => {
    expect(
      previewForceClosePrice({
        sig: { averagePrice: 90n * WAD },
        positionType: PositionType.SHORT,
        requestedClosePrice: R,
        pricePenalty: pen,
      }),
    ).toBe(90n * WAD);
    expect(
      previewForceClosePrice({
        sig: { averagePrice: 100n * WAD },
        positionType: PositionType.SHORT,
        requestedClosePrice: R,
        pricePenalty: pen,
      }),
    ).toBe(98n * WAD);
  });
});
