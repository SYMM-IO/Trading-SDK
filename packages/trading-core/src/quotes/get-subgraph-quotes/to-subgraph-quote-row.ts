import type { PositionType, QuoteStatus } from "../../symmio-contracts/symmio/types";
import {
  toAddress,
  toAddressOrNull,
  toBigIntOrNull,
  toBigIntOrZero,
  toNumberOrNull,
} from "../../symmio-subgraph/subgraph-decode";
import type { SubgraphQuotesQuery } from "../../symmio-subgraph/types/generated/analytics/graphql";
import type { SubgraphQuoteRow } from "./types";

/** A single `quotes` entity as returned by the subgraph. */
export type RawSubgraphQuoteRow = SubgraphQuotesQuery["quotes"][number];

/**
 * Decode one raw `quotes` entity into a {@link SubgraphQuoteRow}.
 *
 * @param row - The raw entity.
 * @returns The decoded row.
 */
export function toSubgraphQuoteRow(row: RawSubgraphQuoteRow): SubgraphQuoteRow {
  return {
    id: row.id,
    source: toAddress(row.source),
    quoteId: toBigIntOrZero(row.quoteId),
    quoteStatus: row.quoteStatus === null ? null : (row.quoteStatus as QuoteStatus),
    partyA: toAddress(row.partyA),
    partyB: toAddressOrNull(row.partyB),
    symbolId: toNumberOrNull(row.symbolId),
    symbol: row.symbol,
    positionType: row.positionType === null ? null : (row.positionType as PositionType),
    quantity: toBigIntOrNull(row.quantity),
    fillAmount: toBigIntOrNull(row.fillAmount),
    closedAmount: toBigIntOrNull(row.closedAmount),
    openedPrice: toBigIntOrNull(row.openedPrice),
    accumulatedPaidFunding: toBigIntOrNull(row.accumulatedPaidFunding),
    lastFundingPaymentTimestamp: toNumberOrNull(row.lastFundingPaymentTimestamp),
    userPaidFunding: toBigIntOrNull(row.userPaidFunding),
    userReceivedFunding: toBigIntOrNull(row.userReceivedFunding),
    timestampSendQuote: toNumberOrNull(row.timestampSendQuote),
    timestampOpenPosition: toNumberOrNull(row.timestampOpenPosition),
    timestampFullyClose: toNumberOrNull(row.timestampFullyClose),
    timestamp: Number(row.timestamp),
    blockNumber: toBigIntOrZero(row.blockNumber),
  };
}
