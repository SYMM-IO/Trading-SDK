import type { Address, Hex } from "viem";

/**
 * One `FundingIndexCheckpoint` entity: the funding-rate index of one market and
 * PartyB at a point in time. Rates and fees are 18-decimal `bigint`; `null`
 * marks a field the subgraph has not indexed for this checkpoint.
 */
export interface FundingIndexCheckpointRow {
  /** Subgraph entity id (stable; use as a row key or `idGt` cursor). */
  id: string;
  /** Diamond address the checkpoint was indexed from (the subgraph's `source`). */
  source: Address;
  /** Market id. */
  symbolId: number;
  /** PartyB (the solver). */
  partyB: Address;
  /** The event that wrote the checkpoint, as indexed. */
  eventType: string;
  /** Raw long rate, before the market-price conversion. */
  rawLongRate: bigint | null;
  /** Raw short rate, before the market-price conversion. */
  rawShortRate: bigint | null;
  /** Market price the rates were converted at. */
  marketPrice: bigint | null;
  /** Current long rate. */
  currentLongRate: bigint | null;
  /** Current short rate. */
  currentShortRate: bigint | null;
  /** Accumulated long rate (the index). */
  accumulatedLongRate: bigint | null;
  /** Accumulated short rate (the index). */
  accumulatedShortRate: bigint | null;
  /** Epoch length (seconds). */
  epochDuration: bigint | null;
  /** Last updated epoch. */
  lastUpdatedEpoch: bigint | null;
  /** First epoch. */
  startEpoch: bigint | null;
  /** First epoch's start (unix seconds), or `null`. */
  startEpochTimestamp: number | null;
  /** Long fee snapshot. */
  snapshotLongFee: bigint | null;
  /** Short fee snapshot. */
  snapshotShortFee: bigint | null;
  /** Block timestamp (unix seconds). */
  timestamp: number;
  /** Block number. */
  blockNumber: bigint;
  /** Transaction hash. */
  transaction: Hex;
}
