import { describe, expect, it } from "vitest";
import { SymmError } from "../../shared/errors/symm-error";
import { SubAccountIsolationType } from "../../symmio-contracts/account-layer/types";
import { PositionType } from "../../symmio-contracts/symmio/types";
import { makeUnifiedQuote, TEST_VA } from "../unified-quote.test";
import { resolveQuoteGroupingStrategy } from "./group-strategy";
import type { QuoteGroupingStrategy } from "./quote-group";

const quote = makeUnifiedQuote({ symbolId: 7n, positionType: PositionType.SHORT, vaAddress: TEST_VA });

describe("resolveQuoteGroupingStrategy", () => {
  it("MARKET_DIRECTION keys by market + side", () => {
    const keyOf = resolveQuoteGroupingStrategy(SubAccountIsolationType.MARKET_DIRECTION);
    expect(keyOf(quote)).toEqual({
      key: `md:7:${PositionType.SHORT}`,
      by: { symbolId: 7n, positionType: PositionType.SHORT },
    });
  });

  it("MARKET keys by market only (both sides collapse)", () => {
    const keyOf = resolveQuoteGroupingStrategy(SubAccountIsolationType.MARKET);
    expect(keyOf(quote)).toEqual({ key: "m:7", by: { symbolId: 7n } });
  });

  it.each([SubAccountIsolationType.POSITION, SubAccountIsolationType.CUSTOM])(
    "%s keys per quote with the quote's full identity",
    (isolation) => {
      const keyOf = resolveQuoteGroupingStrategy(isolation);
      expect(keyOf(quote)).toEqual({
        key: quote.key,
        by: { symbolId: 7n, positionType: PositionType.SHORT, vaAddress: TEST_VA },
      });
    },
  );

  it("returns a custom keyOf unchanged", () => {
    const custom: QuoteGroupingStrategy = {
      keyOf: (q) => ({ key: `va:${q.vaAddress}`, by: { vaAddress: q.vaAddress } }),
    };
    expect(resolveQuoteGroupingStrategy(custom)).toBe(custom.keyOf);
  });

  it("throws SymmError for an unknown isolation type", () => {
    expect(() => resolveQuoteGroupingStrategy(99 as unknown as QuoteGroupingStrategy)).toThrow(SymmError);
  });
});
