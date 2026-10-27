import type { Address, Hex } from "viem";
import type { PositionType } from "../../symmio-contracts/symmio/types";

/**
 * One `QuoteFundingSettlement` entity: a funding settlement on a quote.
 * Amounts are 18-decimal wei `bigint`; `signedAmount` is as indexed (its sign
 * is the subgraph's, never re-signed by the SDK).
 */
export interface QuoteFundingSettlementRow {
  /** Subgraph entity id (stable; use as a row key or `idGt` cursor). */
  id: string;
  /** Diamond address the settlement was indexed from (the subgraph's `source`). */
  source: Address;
  /** On-chain quote id. */
  quoteId: bigint;
  /** PartyA of the quote. */
  partyA: Address;
  /** PartyB (the solver) of the quote. */
  partyB: Address;
  /** Market id. */
  symbolId: number;
  /** Long or short. */
  positionType: PositionType;
  /** What triggered the settlement, as indexed. */
  trigger: string;
  /** Open amount the settlement applied to. */
  openAmount: bigint;
  /** Settled amount, as indexed (signed). */
  signedAmount: bigint;
  /** Amount PartyA paid. */
  paidByPartyA: bigint;
  /** Amount PartyA received. */
  receivedByPartyA: bigint;
  /** Funding index before the settlement. */
  previousAccumulatedPaidFunding: bigint;
  /** Funding index after the settlement. */
  newAccumulatedPaidFunding: bigint;
  /** Funding index change per unit. */
  fundingDeltaPerUnit: bigint;
  /** Last payment time before the settlement (unix seconds). */
  previousLastFundingPaymentTimestamp: number;
  /** Last payment time after the settlement (unix seconds). */
  newLastFundingPaymentTimestamp: number;
  /** Epoch paid through before the settlement, or `null`. */
  previousPaidThroughEpoch: bigint | null;
  /** Epoch paid through after the settlement, or `null`. */
  newPaidThroughEpoch: bigint | null;
  /** Whether the settlement moved a balance. */
  balanceChanged: boolean;
  /** Block timestamp (unix seconds). */
  timestamp: number;
  /** Block number. */
  blockNumber: bigint;
  /** Transaction hash. */
  transaction: Hex;
}
