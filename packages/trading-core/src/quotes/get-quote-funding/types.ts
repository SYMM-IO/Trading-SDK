/**
 * Funding totals for one quote, read from the analytics subgraph.
 *
 * All amount fields are 18-decimal-wei `bigint`. `net = paid − received`, so a
 * positive value means the user has net-paid funding over the position's life
 * and a negative value means the user has net-received it.
 */
export interface QuoteFundingData {
  /** On-chain quote id this row belongs to. */
  quoteId: bigint;
  /** Cumulative funding partyA paid to partyB (wei). */
  paid: bigint;
  /** Cumulative funding partyA received from partyB (wei). */
  received: bigint;
  /** `paid − received` (wei). Positive = net paid; negative = net received. */
  net: bigint;
}
