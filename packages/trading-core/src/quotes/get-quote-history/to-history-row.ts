import { getAddress, type Hex } from "viem";
import type { OrderType, PositionType, QuoteStatus } from "../../symmio-contracts/symmio/types";
import type { QuoteEventsForHistoryQuery } from "../../symmio-subgraph/types/generated/analytics/graphql";
import { eventTypeToQuoteStatus, LIQUIDATION_EVENT_TYPES } from "./close-type";
import { QuoteCloseEventType, type QuoteHistoryRow } from "./types";

/** A single `quoteEvents` row as returned by the history query. */
export type RawQuoteEventRow = QuoteEventsForHistoryQuery["quoteEvents"][number];

/** Parse a wei string to `bigint`, defaulting null/undefined to `0n`. */
function toBigInt(value: string | null | undefined): bigint {
  return value ? BigInt(value) : 0n;
}

/** Parse the event `metadata` JSON, returning `null` on absence or malformed input. */
function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Read a wei field from the metadata snapshot as a positive `bigint`, or `null`
 * when it is absent, malformed, or non-positive (so a missing snapshot field
 * falls back to the quote's mutable value rather than overwriting it with zero).
 */
function positiveWei(value: unknown): bigint | null {
  if (value === undefined || value === null) return null;

  const text = String(value).trim();
  if (text === "") return null;

  let parsed: bigint;
  try {
    parsed = BigInt(text);
  } catch {
    return null;
  }
  return parsed > 0n ? parsed : null;
}

/**
 * Build a {@link QuoteHistoryRow} from one immutable `quoteEvents` row, overlaying
 * the event's frozen `metadata` snapshot (amount, close price, open price) onto
 * the otherwise-mutable quote. Without this overlay, every partial-close row of a
 * quote would show its final mutable state instead of the amount/price of that
 * individual close.
 *
 * @param row - One `quoteEvents` row from {@link "QuoteEventsForHistoryDocument"}.
 * @returns The decoded, snapshot-applied history row.
 */
export function toQuoteHistoryRow(row: RawQuoteEventRow): QuoteHistoryRow {
  const eventType = row.type as QuoteCloseEventType;
  const quote = row.quote;
  const isLiquidation = LIQUIDATION_EVENT_TYPES.has(eventType);

  const metadata = parseMetadata(row.metadata);
  const snapshotAmount = metadata ? positiveWei(metadata.amount) : null;
  const snapshotClosePrice = metadata ? positiveWei(metadata.closePrice) : null;
  const snapshotOpenedPrice = metadata ? positiveWei(metadata.openedPrice) : null;

  // Overlay the immutable per-event snapshot over the mutable quote values. The
  // snapshot `amount` is this event's settled size — it drives both the closed
  // amount and the close-request quantity (mirrors the reference frontend's applyHistoryCloseEventMetadata).
  const closedAmount = snapshotAmount ?? toBigInt(quote.closedAmount);
  const quantityToClose = snapshotAmount ?? toBigInt(quote.quantityToClose);
  const avgClosedPrice = snapshotClosePrice ?? toBigInt(quote.averageClosedPrice);
  const openedPrice = snapshotOpenedPrice ?? toBigInt(quote.openedPrice);
  const liquidateAmount = isLiquidation
    ? (snapshotAmount ?? toBigInt(quote.liquidateAmount))
    : toBigInt(quote.liquidateAmount);
  const liquidatePrice = isLiquidation
    ? (snapshotClosePrice ?? toBigInt(quote.liquidatePrice))
    : toBigInt(quote.liquidatePrice);

  return {
    eventId: row.id,
    closeEventType: eventType,
    closedAt: Number(row.timestamp),
    quoteId: toBigInt(row.quoteId),
    marketId: quote.symbolId ? Number(quote.symbolId) : 0,
    symbol: quote.symbol ?? null,
    positionType: (quote.positionType ?? 0) as PositionType,
    orderType: (quote.orderTypeOpen ?? 0) as OrderType,
    quoteStatus: eventTypeToQuoteStatus[eventType] ?? ((quote.quoteStatus ?? 0) as QuoteStatus),
    quantity: toBigInt(quote.quantity),
    openedPrice,
    requestedOpenPrice: toBigInt(quote.requestedOpenPrice),
    avgClosedPrice,
    closedAmount,
    quantityToClose,
    liquidateAmount,
    liquidatePrice,
    partyA: getAddress(quote.partyA),
    partyB: quote.partyB ? getAddress(quote.partyB) : null,
    subAccount: quote.subAccount ? getAddress(quote.subAccount.id) : null,
    blockNumber: row.blockNumber ? BigInt(row.blockNumber) : undefined,
    transaction: row.transaction ? (row.transaction as Hex) : undefined,
    rawMetadata: row.metadata,
  };
}
