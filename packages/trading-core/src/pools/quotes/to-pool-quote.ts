import type { PoolQuotesQuery } from "../../symmio-subgraph/types/generated/analytics/graphql";
import type { PoolQuote } from "../types";

/** One raw `quotes` row as the pool-quotes document selects it. */
type RawPoolQuoteRow = PoolQuotesQuery["quotes"][number];

/**
 * Parse a subgraph decimal string into a `bigint`, or `null` when absent.
 *
 * The subgraph reports integers as strings, but a malformed or fractional value
 * would make `BigInt()` throw and take down a whole page of rows — so anything
 * unparseable becomes `null` rather than an exception.
 */
function toBigIntOrNull(raw: string | null | undefined): bigint | null {
  if (raw === null || raw === undefined || raw.trim() === "") return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

/** Parse a required numeric string, defaulting an unparseable one to `0n`. */
function toBigIntOrZero(raw: string | null | undefined): bigint {
  return toBigIntOrNull(raw) ?? 0n;
}

/**
 * Map one raw `quotes` row from the analytics subgraph into a {@link PoolQuote}.
 *
 * `symbolId` is narrowed to `number` because it indexes the solver's market
 * registry everywhere downstream; the subgraph reports it as a `BigInt` string.
 *
 * @param row - One row from the pool-quotes document.
 * @returns The normalized quote.
 */
export function toPoolQuote(row: RawPoolQuoteRow): PoolQuote {
  const symbolId = toBigIntOrNull(row.symbolId);

  return {
    id: row.id,
    quoteId: toBigIntOrZero(row.quoteId),
    quoteStatus: row.quoteStatus,
    positionType: row.positionType,
    orderTypeOpen: row.orderTypeOpen,
    symbol: row.symbol,
    symbolId: symbolId === null ? null : Number(symbolId),
    partyA: row.partyA,
    partyB: row.partyB,
    quantity: toBigIntOrNull(row.quantity),
    closedAmount: toBigIntOrNull(row.closedAmount),
    quantityToClose: toBigIntOrNull(row.quantityToClose),
    openedPrice: toBigIntOrNull(row.openedPrice),
    requestedOpenPrice: toBigIntOrNull(row.requestedOpenPrice),
    averageClosedPrice: toBigIntOrNull(row.averageClosedPrice),
    closePrice: toBigIntOrNull(row.closePrice),
    initialOpenedPrice: toBigIntOrNull(row.initialOpenedPrice),
    liquidateAmount: toBigIntOrNull(row.liquidateAmount),
    liquidatePrice: toBigIntOrNull(row.liquidatePrice),
    timestamp: Number(toBigIntOrZero(row.timestamp)),
    blockNumber: toBigIntOrZero(row.blockNumber),
  };
}
