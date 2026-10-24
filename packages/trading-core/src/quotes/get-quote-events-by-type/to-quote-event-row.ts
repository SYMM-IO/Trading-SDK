import type { Hex } from "viem";
import { toBigIntOrZero } from "../../symmio-subgraph/subgraph-decode";
import type { QuoteEventsForQuoteByTypeQuery } from "../../symmio-subgraph/types/generated/analytics/graphql";
import type { QuoteEventRow, QuoteEventType, QuoteSubgraphEventType } from "./types";

/** A single `quoteEvents` row as returned by the events query. */
export type RawQuoteEventNode = QuoteEventsForQuoteByTypeQuery["quoteEvents"][number];

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
export function toQuoteEventRow<TType extends QuoteSubgraphEventType = QuoteEventType>(
  row: RawQuoteEventNode,
): QuoteEventRow<TType> {
  const metadata = parseMetadata(row.metadata);
  return {
    eventId: row.id,
    quoteId: toBigIntOrZero(row.quoteId),
    type: row.type as TType,
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
