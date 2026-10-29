import type { Address } from "viem";
import type { PositionType, QuoteStatus } from "../../symmio-contracts/symmio/types";

/**
 * One analytics-subgraph `Quote` entity, as indexed — not the on-chain struct
 * (read that with `getQuote`). Amounts and prices are 18-decimal wei `bigint`;
 * `null` marks a field the subgraph has not indexed for this quote.
 */
export interface SubgraphQuoteRow {
  /** Subgraph entity id (`<quoteId>-<source>`; use as an `idGt` cursor). */
  id: string;
  /** Diamond address the quote was indexed from (the subgraph's `source`). */
  source: Address;
  /** On-chain quote id. */
  quoteId: bigint;
  /** Lifecycle status, or `null`. */
  quoteStatus: QuoteStatus | null;
  /** PartyA (SubAccount or Virtual Account). */
  partyA: Address;
  /** PartyB (the solver), or `null`. */
  partyB: Address | null;
  /** Market id, or `null`. */
  symbolId: number | null;
  /** Market ticker, or `null`. */
  symbol: string | null;
  /** Long or short, or `null`. */
  positionType: PositionType | null;
  /** Quote quantity. */
  quantity: bigint | null;
  /** Filled quantity. */
  fillAmount: bigint | null;
  /** Quantity closed so far. */
  closedAmount: bigint | null;
  /** Current open price. */
  openedPrice: bigint | null;
  /** Funding index the quote has paid through (signed; an index, not an amount). */
  accumulatedPaidFunding: bigint | null;
  /** Last funding payment (unix seconds), or `null`. */
  lastFundingPaymentTimestamp: number | null;
  /** Cumulative funding PartyA paid (wei). */
  userPaidFunding: bigint | null;
  /** Cumulative funding PartyA received (wei). */
  userReceivedFunding: bigint | null;
  /** When the quote was sent (unix seconds), or `null`. */
  timestampSendQuote: number | null;
  /** When the position opened (unix seconds), or `null`. */
  timestampOpenPosition: number | null;
  /** When the position fully closed (unix seconds), or `null`. */
  timestampFullyClose: number | null;
  /** Entity timestamp (unix seconds). */
  timestamp: number;
  /** Block number of the last update. */
  blockNumber: bigint;
}
