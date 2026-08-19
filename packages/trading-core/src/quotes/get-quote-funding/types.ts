/**
 * Funding totals for one quote, read from the analytics subgraph.
 *
 * All amount fields are 18-decimal-wei `bigint`. `netReceived = received − paid`
 * — the P&L perspective every trading venue presents — so a positive value means
 * the position has **earned** funding over its life and a negative value means it
 * has **paid** for it.
 *
 * Note this is the inverse of the on-chain `int256`, which is cost-positive. The
 * SDK nets it the way it is read, so consumers never negate.
 */
export interface QuoteFundingData {
  /** On-chain quote id this row belongs to. */
  quoteId: bigint;
  /** Cumulative funding partyA paid to partyB (wei). */
  paid: bigint;
  /** Cumulative funding partyA received from partyB (wei). */
  received: bigint;
  /** `received − paid` (wei). Positive = the position earned funding; negative = it paid for it. */
  netReceived: bigint;
}
