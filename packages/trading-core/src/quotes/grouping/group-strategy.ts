import { SymmError } from "../../shared/errors/symm-error";
import { SubAccountIsolationType } from "../../symmio-contracts/account-layer/types";
import type { UnifiedQuote } from "../unified-quote";
import type { QuoteGroupingStrategy, QuoteGroupKey, QuoteGroupKeyFn } from "./quote-group";

/** Group by market only — both sides of a market collapse together (`MARKET` isolation). */
function keyByMarket(quote: UnifiedQuote): QuoteGroupKey {
  return { key: `m:${quote.symbolId}`, by: { symbolId: quote.symbolId } };
}

/** Group by market + side (`MARKET_DIRECTION` isolation — what the lowcap UI used). */
function keyByMarketDirection(quote: UnifiedQuote): QuoteGroupKey {
  return {
    key: `md:${quote.symbolId}:${quote.positionType}`,
    by: { symbolId: quote.symbolId, positionType: quote.positionType },
  };
}

/**
 * Group per single quote — no aggregation (`POSITION` and `CUSTOM` isolation).
 * The group carries the quote's full identity so consumers can label it.
 */
function keyPerQuote(quote: UnifiedQuote): QuoteGroupKey {
  return {
    key: quote.key,
    by: { symbolId: quote.symbolId, positionType: quote.positionType, vaAddress: quote.vaAddress },
  };
}

/**
 * Resolve a {@link QuoteGroupingStrategy} to the {@link QuoteGroupKeyFn} that
 * places each quote into its group.
 *
 * A `{ keyOf }` object is returned as-is. A {@link SubAccountIsolationType} maps
 * to its built-in strategy: `MARKET` groups by market, `MARKET_DIRECTION` by
 * market + side, and `POSITION` / `CUSTOM` produce one group per quote (custom
 * isolation places trades in manually-managed VAs, so consumers that want
 * VA-based grouping pass their own `keyOf`).
 *
 * @param strategy - The grouping strategy.
 * @returns The key function for {@link groupQuotes}.
 * @throws {SymmError} when given an unknown isolation type.
 */
export function resolveQuoteGroupingStrategy(strategy: QuoteGroupingStrategy): QuoteGroupKeyFn {
  if (typeof strategy === "object") return strategy.keyOf;
  switch (strategy) {
    case SubAccountIsolationType.MARKET:
      return keyByMarket;
    case SubAccountIsolationType.MARKET_DIRECTION:
      return keyByMarketDirection;
    case SubAccountIsolationType.POSITION:
    case SubAccountIsolationType.CUSTOM:
      return keyPerQuote;
    default:
      throw new SymmError(
        "validation",
        "UNKNOWN_GROUPING_STRATEGY",
        `groupQuotes: unknown grouping strategy \`${strategy}\`.`,
      );
  }
}
