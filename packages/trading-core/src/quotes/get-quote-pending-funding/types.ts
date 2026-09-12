/**
 * Pending (not yet settled) accumulated funding for one quote.
 *
 * Read with {@link getQuotePendingFunding}. Settled funding lives elsewhere —
 * {@link getQuoteFunding} reads it from the analytics subgraph.
 */
export interface QuotePendingFunding {
  /** On-chain quote id. */
  quoteId: bigint;
  /**
   * Funding accrued since the quote's last settlement, income-positive like every SDK funding
   * amount: `> 0n` the position will receive it, `< 0n` it owes it. 18-decimal collateral units
   * (SYMMIO's internal scale, same as `allocatedBalance`), truncated toward zero per quote.
   * The negation of the contract's cost-positive `getQuoteFundingDebts`. `0n` for pairs whose
   * accumulated funding has not started, closed/liquidated quotes and unknown ids.
   */
  pendingNetReceived: bigint;
}
