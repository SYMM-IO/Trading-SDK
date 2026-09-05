import { SymmError } from "../../shared/errors/symm-error";
import { SubAccountIsolationType } from "../../symmio-contracts/account-layer/types";
import type { UnifiedQuote } from "../unified-quote";
import type { QuoteGroupingStrategy, QuoteGroupKey, QuoteGroupKeyFn } from "./quote-group";

/** Group by market + side — the `MARKET_DIRECTION` strategy, the only isolation-backed one. */
function keyByMarketDirection(quote: UnifiedQuote): QuoteGroupKey {
  return {
    key: `md:${quote.symbolId}:${quote.positionType}`,
    by: { symbolId: quote.symbolId, positionType: quote.positionType },
  };
}

/**
 * Key a quote by market only, collapsing both sides of a market into one group.
 *
 * Not reachable through a {@link SubAccountIsolationType} — grouped positions are
 * defined for `MARKET_DIRECTION` only (see {@link supportsQuoteGrouping}). Pass it
 * as an explicit `{ keyOf }` when you deliberately want market-wide folding and
 * accept that the aggregated metrics mix longs and shorts.
 *
 * @param quote - The quote to place into a group.
 * @returns The group key `m:<symbolId>` and its `{ symbolId }` dimension.
 *
 * @example
 * ```ts
 * const groups = groupQuotes(positions, { keyOf: keyQuoteByMarket });
 * ```
 */
export function keyQuoteByMarket(quote: UnifiedQuote): QuoteGroupKey {
  return { key: `m:${quote.symbolId}`, by: { symbolId: quote.symbolId } };
}

/**
 * Key a quote by its own identity, producing one single-child group per quote —
 * grouping with no aggregation.
 *
 * Not reachable through a {@link SubAccountIsolationType} (see
 * {@link supportsQuoteGrouping}). Pass it as an explicit `{ keyOf }` to render
 * ungrouped positions through the same `QuoteGroup` shape the grouped UI uses.
 *
 * @param quote - The quote to place into a group.
 * @returns The quote's own `key` and its full `{ symbolId, positionType, vaAddress }` identity.
 *
 * @example
 * ```ts
 * const groups = groupQuotes(positions, { keyOf: keyQuotePerQuote });
 * // every group has isAggregate === false
 * ```
 */
export function keyQuotePerQuote(quote: UnifiedQuote): QuoteGroupKey {
  return {
    key: quote.key,
    by: { symbolId: quote.symbolId, positionType: quote.positionType, vaAddress: quote.vaAddress },
  };
}

/**
 * Whether grouped positions are defined for an isolation type.
 *
 * Only `MARKET_DIRECTION` groups. It is the one isolation where a market + side
 * cohort is a real on-chain unit — the AccountLayer allocates one Virtual Account
 * per market + direction — so folding that cohort's quotes into a single row
 * aggregates values that genuinely belong to the same position. Under `MARKET`,
 * `POSITION`, or `CUSTOM` isolation the same fold would merge quotes the protocol
 * keeps apart (or that never shared a VA at all), producing totals, leverage, and
 * group-level actions that do not correspond to anything on-chain.
 *
 * @param isolationType - The subaccount's on-chain isolation type.
 * @returns `true` only for `MARKET_DIRECTION`.
 *
 * @example
 * ```ts
 * if (supportsQuoteGrouping(subAccount.isolationType)) {
 *   const groups = groupQuotes(positions, subAccount.isolationType);
 * }
 * ```
 */
export function supportsQuoteGrouping(isolationType: SubAccountIsolationType): boolean {
  return isolationType === SubAccountIsolationType.MARKET_DIRECTION;
}

/** The rejection every unsupported-isolation path throws, built in one place. */
function unsupportedIsolationError(isolationType: SubAccountIsolationType): SymmError {
  const name = SubAccountIsolationType[isolationType] ?? isolationType;
  return new SymmError(
    "validation",
    "UNSUPPORTED_GROUPING_ISOLATION",
    `Grouped positions are only defined for ${SubAccountIsolationType[SubAccountIsolationType.MARKET_DIRECTION]} isolation (got ${name}). Pass a custom \`{ keyOf }\` — e.g. \`keyQuoteByMarket\` or \`keyQuotePerQuote\` — to group on another dimension.`,
  );
}

/**
 * Throw unless grouped positions are defined for `isolationType`.
 *
 * The throwing counterpart of {@link supportsQuoteGrouping}, for call sites that
 * want to fail loudly rather than branch.
 *
 * @param isolationType - The subaccount's on-chain isolation type.
 * @throws {SymmError} `validation` / `UNSUPPORTED_GROUPING_ISOLATION` for any type
 *   other than `MARKET_DIRECTION`.
 *
 * @example
 * ```ts
 * assertQuoteGroupingSupported(subAccount.isolationType);
 * const groups = groupQuotes(positions, subAccount.isolationType);
 * ```
 */
export function assertQuoteGroupingSupported(isolationType: SubAccountIsolationType): void {
  if (supportsQuoteGrouping(isolationType)) return;
  throw unsupportedIsolationError(isolationType);
}

/**
 * Resolve a {@link QuoteGroupingStrategy} to the {@link QuoteGroupKeyFn} that
 * places each quote into its group.
 *
 * A `{ keyOf }` object is returned as-is. The only {@link SubAccountIsolationType}
 * accepted is `MARKET_DIRECTION` (keys by market + side) — every other isolation
 * type is rejected, because grouped positions are not defined for it (see
 * {@link supportsQuoteGrouping}). To fold on another dimension, pass an explicit
 * `{ keyOf }`; {@link keyQuoteByMarket} and {@link keyQuotePerQuote} ship as
 * ready-made key functions.
 *
 * @param strategy - The grouping strategy.
 * @returns The key function for {@link groupQuotes}.
 * @throws {SymmError} `UNSUPPORTED_GROUPING_ISOLATION` for `MARKET` / `POSITION` /
 *   `CUSTOM`, or `UNKNOWN_GROUPING_STRATEGY` for a value that is not an isolation
 *   type at all.
 */
export function resolveQuoteGroupingStrategy(strategy: QuoteGroupingStrategy): QuoteGroupKeyFn {
  if (typeof strategy === "object") return strategy.keyOf;
  if (strategy === SubAccountIsolationType.MARKET_DIRECTION) return keyByMarketDirection;
  if (SubAccountIsolationType[strategy] === undefined) {
    throw new SymmError(
      "validation",
      "UNKNOWN_GROUPING_STRATEGY",
      `groupQuotes: unknown grouping strategy \`${strategy}\`.`,
    );
  }
  throw unsupportedIsolationError(strategy);
}
