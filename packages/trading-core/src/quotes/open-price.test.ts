import { describe, expect, it } from "vitest";
import { hasUnsettledOpenPrice, leveragePriceOf, openPriceOf, settledOpenPriceOf } from "./open-price";

const SETTLED = 150_000000000000000000n;
const REQUESTED = 149_000000000000000000n;

describe("settledOpenPriceOf", () => {
  it("returns the settled price once it is on record", () => {
    expect(settledOpenPriceOf({ openedPrice: SETTLED })).toBe(SETTLED);
  });

  it("treats a missing and a zero open price alike", () => {
    expect(settledOpenPriceOf({ openedPrice: undefined })).toBeUndefined();
    expect(settledOpenPriceOf({ openedPrice: 0n })).toBeUndefined();
  });
});

describe("hasUnsettledOpenPrice", () => {
  it("is the exact complement of settledOpenPriceOf", () => {
    for (const openedPrice of [SETTLED, 0n, undefined]) {
      expect(hasUnsettledOpenPrice({ openedPrice })).toBe(settledOpenPriceOf({ openedPrice }) === undefined);
    }
  });
});

describe("openPriceOf", () => {
  it("prefers the settled price", () => {
    expect(openPriceOf({ openedPrice: SETTLED, requestedOpenPrice: REQUESTED })).toBe(SETTLED);
  });

  it("falls back to the requested price while unsettled", () => {
    expect(openPriceOf({ openedPrice: undefined, requestedOpenPrice: REQUESTED })).toBe(REQUESTED);
    expect(openPriceOf({ openedPrice: 0n, requestedOpenPrice: REQUESTED })).toBe(REQUESTED);
  });
});

describe("leveragePriceOf", () => {
  it("prefers the requested price — the inverse of openPriceOf's precedence", () => {
    const quote = { openedPrice: SETTLED, requestedOpenPrice: REQUESTED };
    expect(leveragePriceOf(quote)).toBe(REQUESTED);
    expect(openPriceOf(quote)).toBe(SETTLED);
  });

  it("falls back to the settled price when no requested price is on record", () => {
    expect(leveragePriceOf({ openedPrice: SETTLED, requestedOpenPrice: 0n })).toBe(SETTLED);
  });

  it("returns zero when neither price is set", () => {
    expect(leveragePriceOf({ openedPrice: undefined, requestedOpenPrice: 0n })).toBe(0n);
    expect(leveragePriceOf({ openedPrice: 0n, requestedOpenPrice: 0n })).toBe(0n);
  });
});
