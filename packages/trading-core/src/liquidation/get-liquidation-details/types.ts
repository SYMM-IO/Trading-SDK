import type { Address } from "viem";

/**
 * One `LiquidationDetail` entity: a PartyA liquidation with its locked and paid
 * CVA/LF and per-PartyB settlement amounts. Amounts are 18-decimal wei `bigint`;
 * `null` marks a field the subgraph has not indexed for this liquidation.
 */
export interface LiquidationDetailRow {
  /** Subgraph entity id (stable; use as a row key or `idGt` cursor). */
  id: string;
  /** Diamond address the liquidation was indexed from (the subgraph's `source`). */
  source: Address;
  /** The liquidated account. */
  partyA: Address;
  /** Protocol liquidation id. */
  liquidationId: bigint;
  /** Protocol liquidation type, as indexed. */
  liquidationType: number;
  /** When the liquidation started (unix seconds). */
  liquidationTimestamp: number;
  /** Entity timestamp (unix seconds), or `null`. */
  timestamp: number | null;
  /** CVA locked when the liquidation started. */
  lockedCva: bigint | null;
  /** LF locked when the liquidation started. */
  lockedLf: bigint | null;
  /** PartyA maintenance margin locked when the liquidation started. */
  lockedPartyAmm: bigint | null;
  /** CVA paid out by the liquidation. */
  paidCva: bigint | null;
  /** LF paid out by the liquidation. */
  paidLf: bigint | null;
  /** Account uPnL at liquidation. */
  upnl: bigint;
  /** Deficit left by the liquidation. */
  deficit: bigint;
  /** Liquidation fee. */
  liquidationFee: bigint;
  /** Whether the liquidation has been settled. */
  settled: boolean;
  /** Whether every position was liquidated. */
  fullyLiquidated: boolean;
  /** Settlement amounts expected per PartyB, or `null`. */
  settlementExpectedAmounts: bigint[] | null;
  /** Settlement amounts actually paid per PartyB, or `null`. */
  settlementActualAmounts: bigint[] | null;
}
