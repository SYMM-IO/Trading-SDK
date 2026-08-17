import { describe, expect, it } from "vitest";
import { SymmError } from "../../shared/errors/symm-error";
import { SubAccountIsolationType } from "../../symmio-contracts/account-layer/types";
import { PositionType } from "../../symmio-contracts/symmio/types";
import { makeUnifiedQuote, TEST_VA } from "../unified-quote.test";
import {
  assertQuoteGroupingSupported,
  keyQuoteByMarket,
  keyQuotePerQuote,
  resolveQuoteGroupingStrategy,
  supportsQuoteGrouping,
} from "./group-strategy";
import type { QuoteGroupingStrategy } from "./quote-group";

const quote = makeUnifiedQuote({ symbolId: 7n, positionType: PositionType.SHORT, vaAddress: TEST_VA });

describe("supportsQuoteGrouping", () => {
  it("accepts MARKET_DIRECTION only", () => {
    expect(supportsQuoteGrouping(SubAccountIsolationType.MARKET_DIRECTION)).toBe(true);
    expect(supportsQuoteGrouping(SubAccountIsolationType.MARKET)).toBe(false);
    expect(supportsQuoteGrouping(SubAccountIsolationType.POSITION)).toBe(false);
    expect(supportsQuoteGrouping(SubAccountIsolationType.CUSTOM)).toBe(false);
  });
});

describe("assertQuoteGroupingSupported", () => {
  it("passes for MARKET_DIRECTION", () => {
    expect(() => assertQuoteGroupingSupported(SubAccountIsolationType.MARKET_DIRECTION)).not.toThrow();
  });

  it.each([SubAccountIsolationType.MARKET, SubAccountIsolationType.POSITION, SubAccountIsolationType.CUSTOM])(
    "throws UNSUPPORTED_GROUPING_ISOLATION for %s",
    (isolation) => {
      expect(() => assertQuoteGroupingSupported(isolation)).toThrow(
        expect.objectContaining({ kind: "validation", code: "UNSUPPORTED_GROUPING_ISOLATION" }),
      );
    },
  );

  it("names the offending isolation type in the message", () => {
    expect(() => assertQuoteGroupingSupported(SubAccountIsolationType.CUSTOM)).toThrow(/CUSTOM/);
  });
});

describe("resolveQuoteGroupingStrategy", () => {
  it("MARKET_DIRECTION keys by market + side", () => {
    const keyOf = resolveQuoteGroupingStrategy(SubAccountIsolationType.MARKET_DIRECTION);
    expect(keyOf(quote)).toEqual({
      key: `md:7:${PositionType.SHORT}`,
      by: { symbolId: 7n, positionType: PositionType.SHORT },
    });
  });

  it.each([SubAccountIsolationType.MARKET, SubAccountIsolationType.POSITION, SubAccountIsolationType.CUSTOM])(
    "rejects %s — grouped positions are MARKET_DIRECTION-only",
    (isolation) => {
      expect(() => resolveQuoteGroupingStrategy(isolation)).toThrow(
        expect.objectContaining({ kind: "validation", code: "UNSUPPORTED_GROUPING_ISOLATION" }),
      );
    },
  );

  it("returns a custom keyOf unchanged", () => {
    const custom: QuoteGroupingStrategy = {
      keyOf: (q) => ({ key: `va:${q.vaAddress}`, by: { vaAddress: q.vaAddress } }),
    };
    expect(resolveQuoteGroupingStrategy(custom)).toBe(custom.keyOf);
  });

  it("throws UNKNOWN_GROUPING_STRATEGY for a value that is not an isolation type", () => {
    expect(() => resolveQuoteGroupingStrategy(99 as unknown as QuoteGroupingStrategy)).toThrow(SymmError);
    expect(() => resolveQuoteGroupingStrategy(99 as unknown as QuoteGroupingStrategy)).toThrow(
      expect.objectContaining({ code: "UNKNOWN_GROUPING_STRATEGY" }),
    );
  });
});

describe("key recipes", () => {
  it("keyQuoteByMarket keys by market only (both sides collapse)", () => {
    expect(keyQuoteByMarket(quote)).toEqual({ key: "m:7", by: { symbolId: 7n } });
  });

  it("keyQuotePerQuote keys per quote with the quote's full identity", () => {
    expect(keyQuotePerQuote(quote)).toEqual({
      key: quote.key,
      by: { symbolId: 7n, positionType: PositionType.SHORT, vaAddress: TEST_VA },
    });
  });
});
