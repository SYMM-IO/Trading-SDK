import {
  toAddress,
  toBigIntOrNull,
  toBigIntOrZero,
  toHex,
  toNumberOrNull,
} from "../../symmio-subgraph/subgraph-decode";
import type { FundingIndexCheckpointsQuery } from "../../symmio-subgraph/types/generated/analytics/graphql";
import type { FundingIndexCheckpointRow } from "./types";

/** A single `fundingIndexCheckpoints` entity as returned by the subgraph. */
export type RawFundingIndexCheckpointRow = FundingIndexCheckpointsQuery["fundingIndexCheckpoints"][number];

/**
 * Decode one raw `fundingIndexCheckpoints` entity into a {@link FundingIndexCheckpointRow}.
 *
 * @param row - The raw entity.
 * @returns The decoded row.
 */
export function toFundingIndexCheckpointRow(row: RawFundingIndexCheckpointRow): FundingIndexCheckpointRow {
  return {
    id: row.id,
    source: toAddress(row.source),
    symbolId: Number(row.symbolId),
    partyB: toAddress(row.partyB),
    eventType: row.eventType,
    rawLongRate: toBigIntOrNull(row.rawLongRate),
    rawShortRate: toBigIntOrNull(row.rawShortRate),
    marketPrice: toBigIntOrNull(row.marketPrice),
    currentLongRate: toBigIntOrNull(row.currentLongRate),
    currentShortRate: toBigIntOrNull(row.currentShortRate),
    accumulatedLongRate: toBigIntOrNull(row.accumulatedLongRate),
    accumulatedShortRate: toBigIntOrNull(row.accumulatedShortRate),
    epochDuration: toBigIntOrNull(row.epochDuration),
    lastUpdatedEpoch: toBigIntOrNull(row.lastUpdatedEpoch),
    startEpoch: toBigIntOrNull(row.startEpoch),
    startEpochTimestamp: toNumberOrNull(row.startEpochTimestamp),
    snapshotLongFee: toBigIntOrNull(row.snapshotLongFee),
    snapshotShortFee: toBigIntOrNull(row.snapshotShortFee),
    timestamp: Number(row.timestamp),
    blockNumber: toBigIntOrZero(row.blockNumber),
    transaction: toHex(row.transaction),
  };
}
