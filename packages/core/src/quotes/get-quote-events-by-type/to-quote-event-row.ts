import type { Hex } from "viem";
import type { QuoteEventsForQuoteByTypeQuery } from "../../symmio-subgraph/types/generated/analytics/graphql";
import { QuoteEventType, type QuoteEventRow } from "./types";

/** A single `quoteEvents` row as returned by the events query. */
export type RawQuoteEventNode = QuoteEventsForQuoteByTypeQuery["quoteEvents"][number];

/** Parse a wei string to `bigint`, defaulting null/undefined to `0n`. */
function toBigInt(value: string | null | undefined): bigint {
  return value ? BigInt(value) : 0n;
}

/** Read a wei field from the metadata snapshot as a `bigint`, or `undefined` when absent / unparsable. */
function optionalWei(value: unknown): bigint | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  if (text === "") return undefined;
  try {
    return BigInt(text);
  } catch {
    return undefined;
  }
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
 * Decode one raw subgraph `QuoteEvent` row into a {@link QuoteEventRow}. The
 * `metadata` JSON varies per event type — every recognized field is decoded and
 * placed on the typed row; missing fields stay `undefined`.
 */
export function toQuoteEventRow(row: RawQuoteEventNode): QuoteEventRow {
  const metadata = parseMetadata(row.metadata);
  return {
    eventId: row.id,
    quoteId: toBigInt(row.quoteId),
    type: row.type as QuoteEventType,
    timestamp: Number(row.timestamp),
    blockNumber: row.blockNumber ? BigInt(row.blockNumber) : undefined,
    transaction: row.transaction ? (row.transaction as Hex) : undefined,
    newPrice: metadata ? optionalWei(metadata.newPrice) : undefined,
    prevPrice: metadata ? optionalWei(metadata.prevPrice) : undefined,
    openQuantity: metadata ? optionalWei(metadata.openQuantity) : undefined,
    fundingPaid: metadata ? optionalWei(metadata.fundingPaid) : undefined,
    fundingReceived: metadata ? optionalWei(metadata.fundingReceived) : undefined,
    rate: metadata ? optionalWei(metadata.rate) : undefined,
    rawMetadata: row.metadata,
  };
}
